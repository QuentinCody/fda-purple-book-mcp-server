// FDA Purple Book — bulk data fetch + parse, cached in-memory (24h TTL).
//
// The Purple Book has NO live query API; it publishes a single monthly CSV.
// We download it once, parse it, and serve a synthetic REST surface over the
// cached rows (see api-adapter.ts), exactly like fda-orange-book-mcp-server.

/** A normal browser UA — FDA sits behind Akamai and 302s bot/curl UAs to an abuse page. */
const BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Stable FDA media redirect to the latest Purple Book CSV (mirrors Orange Book's media/76860). */
const STABLE_MEDIA_URL = "https://www.fda.gov/media/182175/download";

/** Fallback: dated path on accessdata. Month name/capitalization varies by year; we try variants. */
const ACCESSDATA_BASE =
    "https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook";

const MONTHS_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const MONTHS_ABBR = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_INDEX: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export interface PurpleBookData {
    records: Record<string, string>[];
    sourceUrl: string;
    fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: PurpleBookData | null = null;

/** RFC-4180 CSV parser (honors quoted fields, embedded commas/newlines, doubled quotes, CRLF). */
export function parseCsv(input: string): string[][] {
    let text = input;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += c; i++; continue;
        }
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ",") { row.push(field); field = ""; i++; continue; }
        if (c === "\r") { i++; continue; }
        if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

function normalizeKey(header: string): string {
    return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isHeaderRow(row: string[]): boolean {
    return (
        row.some((c) => c.trim() === "BLA Number") &&
        row.some((c) => /^applicant$/i.test(c.trim()))
    );
}

/** Best-effort D-Mon-YY → ISO date. `futureHint` = column is an expiry/exclusivity date (may be future). */
function toIsoDate(raw: string, futureHint: boolean): string | null {
    const s = (raw ?? "").trim();
    if (!s || /tbd|^n\/?a$/i.test(s)) return null;
    const m = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
    if (!m) {
        const t = Date.parse(s);
        return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
    }
    const day = Number(m[1]);
    const mi = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
    if (mi === undefined) return null;
    let year = m[3].length === 4 ? Number(m[3]) : 2000 + Number(m[3]);
    if (m[3].length < 4) {
        const nowY = new Date().getUTCFullYear();
        // Past-only columns (approval/licensure) can't be future → roll back a century.
        if (!futureHint && year > nowY) year -= 100;
        if (year < 1900) year += 100;
    }
    const d = new Date(Date.UTC(year, mi, day));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function tryFetch(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": BROWSER_UA, Accept: "text/csv,*/*" },
            redirect: "follow",
        });
        if (!res.ok) return null;
        const text = await res.text();
        // Validate it's the CSV we expect (guards against HTML abuse/redirect pages).
        return text.includes("BLA Number") ? text : null;
    } catch {
        return null;
    }
}

/** Dated fallback URLs, newest-first across recent months, trying name/case variants. */
function candidateUrls(): string[] {
    const now = new Date();
    const urls: string[] = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const y = d.getUTCFullYear();
        const full = MONTHS_FULL[d.getUTCMonth()];
        const abbr = MONTHS_ABBR[d.getUTCMonth()];
        for (const name of [full, full.toLowerCase(), abbr, abbr.toLowerCase()]) {
            urls.push(`${ACCESSDATA_BASE}/${y}/purplebook-search-${name}-data-download.csv`);
        }
    }
    return urls;
}

async function resolveAndFetch(): Promise<{ text: string; url: string }> {
    // 1) Stable media redirect (preferred — no month guessing).
    const stable = await tryFetch(STABLE_MEDIA_URL);
    if (stable) return { text: stable, url: STABLE_MEDIA_URL };
    // 2) Dated accessdata fallback, newest-first.
    for (const url of candidateUrls()) {
        const text = await tryFetch(url);
        if (text) return { text, url };
    }
    throw new Error(
        "Could not locate the FDA Purple Book CSV (tried the stable media URL and recent dated URLs).",
    );
}

/**
 * Parse the Purple Book CSV. The file has two sections: a small "monthly changes"
 * section, then the full database after a SECOND identical header. We key off the
 * LAST `BLA Number` header row so we only ingest the full-database section.
 */
function parseRecords(csvText: string): Record<string, string>[] {
    const rows = parseCsv(csvText);
    let headerIdx = -1;
    for (let r = 0; r < rows.length; r++) {
        if (isHeaderRow(rows[r])) headerIdx = r; // keep the LAST header (full-DB section)
    }
    if (headerIdx === -1) return [];
    const headers = rows[headerIdx].map(normalizeKey);
    const records: Record<string, string>[] = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const cells = rows[r];
        if (cells.every((c) => (c ?? "").trim() === "")) continue;
        if (isHeaderRow(cells)) continue;
        const rec: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
            const key = headers[j];
            if (!key) continue;
            rec[key] = (cells[j] ?? "").trim();
        }
        // Add best-effort ISO variants for date columns (enables exclusivity-cliff SQL on staged data).
        for (const key of Object.keys(rec)) {
            if (key.endsWith("_date") && rec[key]) {
                const iso = toIsoDate(rec[key], /exclus|expir/.test(key));
                if (iso) rec[`${key}_iso`] = iso;
            }
        }
        records.push(rec);
    }
    return records;
}

/** Get parsed Purple Book products, using a 24h in-memory cache. */
export async function getPurpleBookData(): Promise<PurpleBookData> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
    const { text, url } = await resolveAndFetch();
    const records = parseRecords(text);
    cache = { records, sourceUrl: url, fetchedAt: Date.now() };
    return cache;
}
