export const DOWNLOADS_URL = "https://purplebooksearch.fda.gov/downloads";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export interface PurpleBookRelease { report_month: string; source_url: string }

/** Only FDA's published, dated CSV links qualify as known report months. */
export function discoverReleases(html: string): PurpleBookRelease[] {
  const releases = new Map<string, PurpleBookRelease>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let url: URL;
    try { url = new URL(match[1].replace(/&amp;/g, "&"), DOWNLOADS_URL); } catch { continue; }
    if (url.origin !== "https://www.accessdata.fda.gov" || url.search || url.hash) continue;
    const path = /^\/drugsatfda_docs\/PurpleBook\/(\d{4})\/purplebook-search-([a-z]+)-data-download\.csv$/i.exec(url.pathname);
    if (!path) continue;
    const month = MONTHS.findIndex(name => name === path[2].toLowerCase() || name.slice(0, 3) === path[2].toLowerCase()) + 1;
    if (!month) continue;
    const reportMonth = `${path[1]}-${String(month).padStart(2, "0")}`;
    const previous = releases.get(reportMonth);
    if (previous && previous.source_url !== url.href) throw new Error(`Conflicting FDA CSV links for ${reportMonth}`);
    releases.set(reportMonth, { report_month: reportMonth, source_url: url.href });
  }
  if (!releases.size) throw new Error("FDA downloads page contains no recognized monthly CSV links");
  return [...releases.values()].sort((a, b) => b.report_month.localeCompare(a.report_month));
}

async function fetchFda(url: string, signal: AbortSignal): Promise<Response> {
  const allowed = new Set(["https://www.fda.gov", "https://www.accessdata.fda.gov", "https://purplebooksearch.fda.gov"]);
  let target = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    if (!allowed.has(target.origin) || target.username || target.password) throw new Error("Untrusted FDA download URL");
    const response = await fetch(target.href, { signal, redirect: "manual", headers: { Accept: "text/csv,application/octet-stream,text/plain,text/html", "User-Agent": "Mozilla/5.0 (compatible; BioMCP/1.0)" } });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    void response.body?.cancel().catch(() => {});
    const location = response.headers.get("location");
    if (!location) throw new Error("FDA redirect omitted location");
    target = new URL(location, target);
  }
  throw new Error("Too many FDA download redirects");
}

/** Bounds headers and body together; reject non-FDA redirects and oversized inputs. */
export async function readFdaText(url: string): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("Purple Book read exceeded 15 seconds")); }, 15000);
  });
  const receive = async () => {
    const response = await fetchFda(url, controller.signal);
    reader = response.body?.getReader();
    if (!response.ok || !reader) throw new Error(`FDA download HTTP ${response.status}`);
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let bytes = 0;
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new Error("Purple Book download exceeds 8 MiB");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  };
  try { return await Promise.race([receive(), deadline]); }
  finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}
