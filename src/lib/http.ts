import { sha256Hex } from "@bio-mcp/shared";
import { discoverReleases, DOWNLOADS_URL, readFdaText, type PurpleBookRelease } from "./downloads";
import { parseReport } from "./report";
export { parseCsv } from "./report";

export interface PurpleBookData extends ReturnType<typeof parseReport> {
  sourceUrl: string;
  fetchedAt: number;
  reportMonth: string | null;
  sourceSha256: string;
  rawCsv: string;
  sourceBytes: number;
  discovery: "published_download_link";
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, PurpleBookData>();

export async function getPurpleBookReleases() {
  const text = await readFdaText(DOWNLOADS_URL);
  const releases: PurpleBookRelease[] = discoverReleases(text);
  return { source_url: DOWNLOADS_URL, source_sha256: await sha256Hex(text), observed_at: new Date().toISOString(),
    latest_report_month: releases[0].report_month, latest_source_url: releases[0].source_url, releases };
}

async function locate(reportMonth?: string) {
  const { releases } = await getPurpleBookReleases();
  const release = reportMonth ? releases.find(item => item.report_month === reportMonth) : releases[0];
  if (!release) throw new Error(`FDA has not advertised a CSV for ${reportMonth}`);
  return { ...release, discovery: "published_download_link" as const };
}

/** Report selection is cached for 24h; the observation time is distinct from report month. */
export async function getPurpleBookData(reportMonth?: string): Promise<PurpleBookData> {
  if (reportMonth !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonth)) throw new Error("report_month must be YYYY-MM");
  const key = reportMonth ?? "latest";
  const previous = cache.get(key);
  if (previous && Date.now() - previous.fetchedAt < CACHE_TTL_MS) return previous;
  const release = await locate(reportMonth);
  const text = await readFdaText(release.source_url);
  const data: PurpleBookData = { ...parseReport(text, release.report_month), sourceUrl: release.source_url,
    fetchedAt: Date.now(), reportMonth: release.report_month, sourceSha256: await sha256Hex(text),
    rawCsv: text, sourceBytes: new TextEncoder().encode(text).length, discovery: release.discovery };
  remember(key, data);
  return data;
}

function remember(key: string, data: PurpleBookData): void {
  const maximum = 4 * 1024 * 1024;
  if (data.sourceBytes > maximum) return;
  while (cache.size >= 12 || [...cache.values()].reduce((sum, item) => sum + item.sourceBytes, data.sourceBytes) > maximum) {
    cache.delete(cache.keys().next().value ?? "latest");
  }
  cache.set(key, data);
}
