import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { getPurpleBookData, getPurpleBookReleases, PurpleBookData } from "./http";
import { reportControls, reportMetadata } from "./report-response";
import { columnKeys } from "./report";

/** Case-insensitive substring match filter against record field names. */
function matchesFilter(
    records: Record<string, string>[],
    params: Record<string, unknown>,
    headers: string[],
): number[] {
    const filters = Object.entries(params).filter(
        ([key, val]) =>
            !["limit", "offset", "report_month", "expected_source_sha256"].includes(key) && val !== undefined && val !== "",
    );
    const known = new Set([...columnKeys(headers), ...records.flatMap(record => Object.keys(record))]);
    for (const [key, value] of filters) {
        if (!known.has(key) || !["string", "number"].includes(typeof value)) throw new Error(`Unknown or invalid Purple Book field filter: ${key}`);
    }
    return records.flatMap((record, index) =>
        filters.every(([key, val]) => {
            const fieldValue = record[key];
            if (fieldValue === undefined) return false;
            return fieldValue.toLowerCase().includes(String(val).toLowerCase());
        }) ? [index] : [],
    );
}

/**
 * Create an ApiFetchFn for FDA Purple Book data.
 *
 * Route:
 *   GET /products — Search licensed biological products (biologics, biosimilars, interchangeables).
 *
 * All query parameters are case-insensitive substring filters against the
 * corresponding (snake_case) field names. Special params: limit, offset.
 */
export function createPurpleBookApiFetch(): ApiFetchFn {
    return async (request) => {
        if (request.method !== "GET" || request.body !== undefined) throw new Error("Purple Book supports body-free GET requests only");
        const path = request.path.replace(/^\/+/, "").split("?")[0];
        const params = reportControls(request.params ?? {});
        if (path === "releases") return { status: 200, data: await getPurpleBookReleases() };

        if (!["report", "changes", "products"].includes(path) && !path.startsWith("products/")) {
            throw new Error(
                `Unknown Purple Book endpoint: /${path}. Use /products, /changes, /report or /releases`,
            );
        }

        const dataset = await getPurpleBookData(params.report_month);
        if (params.expected_source_sha256 && params.expected_source_sha256 !== dataset.sourceSha256) throw new Error("Purple Book CSV differs from expected_source_sha256");
        const metadata = reportMetadata(dataset);
        if (path === "report") return { status: 200, data: { ...metadata, raw_csv: dataset.rawCsv } };
        if (path === "changes" && !dataset.changesAvailable) throw new Error("This historical report has no separate changes section; changes are unavailable, not an empty monthly result");
        const records = path === "changes" ? dataset.changes : dataset.records;
        return buildReportPage(path, dataset, records, params, metadata);
    };
}

function buildReportPage(path: string, dataset: PurpleBookData, records: Record<string, string>[], params: { [x: string]: unknown; limit: number; offset: number; report_month?: string | undefined; expected_source_sha256?: string | undefined; }, metadata: Record<string, unknown>) : Awaited<ReturnType<ApiFetchFn>> {
  const sources = path === "changes" ? dataset.nativeRows.changes : dataset.nativeRows.products;
  const filtered = matchesFilter(records, params, path === "changes" ? dataset.nativeHeaders.changes : dataset.nativeHeaders.products);
  const indices: number[] = [];
  let pageBytes = 0;
  for (const index of filtered.slice(params.offset, params.offset + params.limit)) {
    pageBytes += new TextEncoder().encode(JSON.stringify([records[index], sources[index]])).length;
    if (pageBytes > 2 * 1024 * 1024) {
      if (!indices.length) throw new Error("One Purple Book row exceeds the 2 MiB page limit; inspect the raw CSV via /report");
      break;
    }
    indices.push(index);
  }
  const results = indices.map(index => records[index]);
  const complete = params.offset === 0 && results.length === filtered.length;

  return {
    status: 200,
    completeness: {
      complete, returned: results.length, total_available: filtered.length,
      ...(!complete ? { truncation: { reason: "page_limit", detail: "One page of the matching report section; follow next_offset." } } : {})
    },
    data: {
      total_unfiltered: records.length,
      total_filtered: filtered.length,
      returned: results.length,
      offset: Number(params.offset) || 0,
      limit: Number(params.limit) || 500,
      source_url: dataset.sourceUrl,
      report: metadata,
      section: path === "changes" ? "monthly_changes" : "full_snapshot",
      results,
      row_sources: indices.map(index => sources[index]),
      truncated: !complete,
      next_offset: params.offset + results.length < filtered.length ? params.offset + results.length : null,
    },
  };
}
