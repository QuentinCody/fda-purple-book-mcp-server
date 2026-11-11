import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@bio-mcp/shared/mcp";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { registerCodeMode } from "./code-mode";
import { registerQueryData } from "./query-data";
import { registerGetSchema } from "./get-schema";
import { purpleBookCatalog } from "../spec/catalog";
import { createPurpleBookApiFetch } from "../lib/api-adapter";
import { reportFixture } from "../lib/report.fixture";

afterEach(() => vi.unstubAllGlobals());

it("registers both aliases for all four tools with structured success and error responses", async () => {
  const server = new McpServer({ name: "fixture", version: "1" });
  // SAFETY: discovery and empty-code errors do not call the fixture bindings.
  registerCodeMode(server, { PURPLE_BOOK_DATA_DO: {}, CODE_MODE_LOADER: { get: () => ({}) } } as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  // SAFETY: inspect SDK registry only to invoke real registered callbacks in this test.
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }> })._registeredTools;
  expect(Object.keys(tools)).toHaveLength(8);
  for (const prefix of ["", "mcp_"]) {
    expect(await tools[prefix + "purple_book_search"].handler({ query: "report", max_results: 5 }, {})).toMatchObject({ content: expect.any(Array), structuredContent: { success: true } });
    for (const [tool, args] of [["purple_book_execute", { code: "" }], ["purple_book_query_data", { data_access_id: "fixture", sql: "SELECT 1" }], ["purple_book_get_schema", { data_access_id: "fixture" }]] as const) {
      expect(await tools[prefix + tool].handler(args, {})).toMatchObject({ content: expect.any(Array), structuredContent: expect.any(Object), isError: true });
    }
  }
});

it("preserves report evidence alongside full product rows through shared staging", async () => {
  const csvUrl = "https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/2026/purplebook-search-August-data-download.csv";
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => new Response(url.endsWith("/downloads") ? `<a href="${csvUrl}">CSV</a>` : reportFixture.replaceAll("Company, Inc.", "α".repeat(20000)))));
  const stored: unknown[] = [];
  // SAFETY: fixture implements only the DO fetch methods exercised by shared staging.
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      // SAFETY: payload produced by the actual staging helper under test.
      const payload = await request.json() as { data: unknown };
      stored.push(payload.data); return Response.json({ success: true, tables_created: ["payloads"], total_rows: 1 });
    }
    return Response.json({ success: true, schema: { tables: { payloads: { columns: [{ name: "root_json" }] } } } });
  } }) } as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({ apiFetch: createPurpleBookApiFetch(), catalog: purpleBookCatalog, doNamespace: namespace, stagingPrefix: "purple_book", maxInlineBytes: 30 * 1024 });
  const result = await proxy.handler({ method: "GET", path: "/products", params: { report_month: "2026-08" } }, { sql: () => [] });
  expect(result).toMatchObject({ __staged: true, data_access_id: expect.any(String) });
  const payloads = stored.map(value => typeof value === "string" ? JSON.parse(value) : value);
  expect(payloads).toEqual(expect.arrayContaining([expect.objectContaining({ section: "full_snapshot", returned: 2, report: expect.objectContaining({ report_month: "2026-08", change_row_count: 1, product_row_count: 2, source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/), report_preamble: [["Purple Book August 2026"], ["Report date", "31-Aug-2026"]] }), results: [expect.objectContaining({ strength: "10 mg", applicant: "α".repeat(20000) }), expect.objectContaining({ strength: "20 mg" })] })]));
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});
