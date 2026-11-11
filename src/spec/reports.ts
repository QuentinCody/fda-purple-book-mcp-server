import type { ApiCatalog, ParamDef } from "@bio-mcp/shared/codemode/catalog";

export const reportParams: ParamDef[] = [
  { name: "report_month", type: "string", required: false, description: "YYYY-MM from /releases. Omit for newest advertised report at load time (24h cache). Missing discovery or report files remain errors." },
  { name: "expected_source_sha256", type: "string", required: false, description: "Optional exact CSV text SHA-256 from /report; fails if the selected file differs." },
];

export const reportEndpoints: ApiCatalog["endpoints"] = [
  { method: "GET", path: "/releases", summary: "Discover FDA's published dated CSV links, newest report month first. Does not infer release availability from the calendar.", category: "reports", queryParams: [] },
  { method: "GET", path: "/report", summary: "Inspect selected report month, retrieval time, exact CSV text/hash, native preamble/date text, headers, section layout and row counts. Usually staged; source_sha256 remains on its envelope.", category: "reports", queryParams: reportParams },
  { method: "GET", path: "/changes", summary: "Read only the monthly changes section. Native U/N/R classifications stay attached to their rows. Do not append these to /products. Historical single-section reports fail explicitly because change information is unavailable.", category: "reports", queryParams: [...reportParams,
    { name: "limit", type: "number", required: false, description: "Page size 1–10000, default 500. Product field substring filters are also supported." },
    { name: "offset", type: "number", required: false, description: "Nonnegative row offset, default 0." } ] },
];

export const reportWorkflows: ApiCatalog["workflows"] = [{
  keywords: ["report", "release", "month", "hash", "changes", "snapshot"],
  title: "Inspect one advertised Purple Book report before paging products",
  description: "Select an FDA-advertised month, inspect its CSV provenance, then use the month and hash on every subsequent page. Multiple rows can share one BLA. Publication/retrieval dates do not change product approval dates.",
  code: 'const discovery = await api.get("/releases");\nconst report_month = discovery.latest_report_month;\nif (!report_month) return discovery;\nconst report = await api.get("/report", {report_month});\nif (!report.source_sha256) return report;\nreturn await api.get("/products", {report_month, expected_source_sha256: report.source_sha256, limit: 100, offset: 0});',
}];
