import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reportFixture } from "./report.fixture";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const url = "https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/2026/purplebook-search-August-data-download.csv";
function provider() {
  const fetcher = vi.fn().mockImplementation(async (path: string) => new Response(path.endsWith("/downloads") ? `<a href="${url}">CSV</a>` : reportFixture));
  vi.stubGlobal("fetch", fetcher); return fetcher;
}

it("separates changes and products, retaining report context through filtering and paging", async () => {
  provider(); const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  const products = await api({ method: "GET", path: "/products", params: { report_month: "2026-08", bla_number: "001234", offset: 1, limit: 1 } });
  expect(products.data).toMatchObject({ total_unfiltered: 2, total_filtered: 2, returned: 1, section: "full_snapshot", report: { report_month: "2026-08", source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }, results: [{ strength: "20 mg" }] });
  expect(products.completeness).toMatchObject({ complete: false, returned: 1, total_available: 2 });
  expect(products.data).toMatchObject({ next_offset: null, truncated: true, row_sources: [{ csv_record: 9 }] });
  expect((await api({ method: "GET", path: "/changes", params: { report_month: "2026-08" } })).data).toMatchObject({ total_unfiltered: 1, section: "monthly_changes", results: [{ change: "U" }] });
});

it("guards all pages with the same month and file fingerprint", async () => {
  provider(); const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  const report = await api({ method: "GET", path: "/report", params: { report_month: "2026-08" } });
  expect(report.data).toMatchObject({ raw_csv: reportFixture });
  // SAFETY: report endpoint returns the metadata object under test.
  const hash = (report.data as { source_sha256: string }).source_sha256;
  expect((await api({ method: "GET", path: "/products", params: { report_month: "2026-08", expected_source_sha256: hash } })).data).toMatchObject({ returned: 2 });
  await expect(api({ method: "GET", path: "/products", params: { report_month: "2026-08", expected_source_sha256: "0".repeat(64) } })).rejects.toThrow("differs");
});

it("reports historical changes as unavailable, retaining legacy column names", async () => {
  const csv = 'Applicant,Proprietary Name,Proper Name,BLA Type,BLA Number,Approval Date\nCompany,Brand,proper,351(a),001234,12/31/2002\n';
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (path: string) => new Response(path.endsWith("/downloads") ? `<a href="${url}">CSV</a>` : csv)));
  const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  const products = await api({ method: "GET", path: "/products" });
  expect(products.data).toMatchObject({ report: { changes_available: false, change_row_count: null }, results: [{ bla_type: "351(a)" }] });
  await expect(api({ method: "GET", path: "/changes" })).rejects.toThrow("unavailable");
  await expect(api({ method: "GET", path: "/products", params: { license_type: "351(a)" } })).rejects.toThrow("Unknown");
});

it("keeps all source records when a requested page reaches the byte bound", async () => {
  const csv = reportFixture.replaceAll("Company, Inc.", "α".repeat(280000));
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (path: string) => new Response(path.endsWith("/downloads") ? `<a href="${url}">CSV</a>` : csv)));
  const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  const first = await api({ method: "GET", path: "/products", params: { limit: 10000 } });
  expect(first.data).toMatchObject({ returned: 1, total_filtered: 2, next_offset: 1, truncated: true });
  const last = await api({ method: "GET", path: "/products", params: { offset: 1, limit: 10000 } });
  expect(last.data).toMatchObject({ returned: 1, next_offset: null, row_sources: [{ csv_record: 9 }] });
  expect(last.completeness?.complete).toBe(false);
});

it.each([{ method: "POST", path: "/products" }, { method: "GET", path: "/products", body: {} }, { method: "GET", path: "/unknown" }, { method: "GET", path: "/products", params: { offset: -1 } }])("rejects unsupported requests before reading upstream %#", async request => {
  const fetcher = provider(); const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  await expect(api(request)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});

it("executes the advertised provenance-first recipe through the actual adapter", async () => {
  provider(); const api = (await import("./api-adapter")).createPurpleBookApiFetch();
  const { purpleBookCatalog } = await import("../spec/catalog");
  const code = purpleBookCatalog.workflows?.[0].code;
  const result = await new Function("api", `return (async () => { ${code} })();`)({ get: async (path: string, params: Record<string, unknown>) => (await api({ method: "GET", path, params })).data });
  expect(result).toMatchObject({ report: { report_month: "2026-08" }, returned: 2 });
  expect(purpleBookCatalog.endpointCount).toBe(purpleBookCatalog.endpoints.length);
});
