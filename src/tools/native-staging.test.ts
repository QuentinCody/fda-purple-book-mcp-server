/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
import { PurpleBookDataDO } from "../do";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { purpleBookCatalog } from "../spec/catalog";
import { McpServer } from "@bio-mcp/shared/mcp";
import { verifyCitationEnvelope } from "@bio-mcp/shared";
import { registerQueryData } from "./query-data";

it("recovers source metadata chunks beside native TEXT rows through both query aliases", async () => {
  const db = new DatabaseSync(":memory:");
  let ready = Promise.resolve();
  const sql = { exec: (query: string, ...values: SQLInputValue[]) => {
    const rows = db.prepare(query).all(...values); const iterator = rows[Symbol.iterator]();
    return { toArray: () => rows, one: () => rows[0], next: () => iterator.next(), [Symbol.iterator]: () => iterator };
  } };
  const transactionSync = <T>(run: () => T): T => {
    db.exec("BEGIN");
    try { const value = run(); db.exec("COMMIT"); return value; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const ctx = { storage: { sql, transactionSync }, blockConcurrencyWhile: (run: () => Promise<void>) => { ready = run(); return ready; } };
  const instance = new PurpleBookDataDO(ctx as unknown as DurableObjectState, {} as Cloudflare.Env);
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => { await ready; return instance.fetch(request); } }) } as unknown as Env["PURPLE_BOOK_DATA_DO"];
  const native = { results: [{ bla_number: "001234", product_number: "001", applicant: " Company, Inc. ", strength: " .2500 ", note: " Óá " }], report: { raw_csv: "α🧬".repeat(50000) } };
  const proxy = createApiProxyTool({ apiFetch: async () => ({ status: 200, data: native }), catalog: purpleBookCatalog, doNamespace: namespace, stagingPrefix: "purple_book", maxInlineBytes: 30720 });
  const server = new McpServer({ name: "fixture", version: "1" }); registerQueryData(server, { PURPLE_BOOK_DATA_DO: namespace });
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<any> }> })._registeredTools;
  try {
    const staged = await proxy.handler({ method: "GET", path: "/products" }, { sql: () => [] }) as { data_access_id: string };
    for (const prefix of ["", "mcp_"]) {
      const rows = async (query: string) => {
        const args = { data_access_id: staged.data_access_id, sql: query, limit: 100 };
        const result = await tools[`${prefix}purple_book_query_data`].handler(args, {});
        expect(result.isError, JSON.stringify(result)).not.toBe(true);
        const proof = await verifyCitationEnvelope({ citation: result.structuredContent._meta.citation, structuredContent: result.structuredContent, toolArguments: args });
        expect(proof.verification).toMatchObject({ query: "verified", result: "verified" });
        return result.structuredContent.data.rows;
      };
      const restored = await rows('SELECT "bla_number", "product_number", "applicant", "strength", "note" FROM results');
      expect(restored).toEqual(native.results);
      const root = (await rows("SELECT root_json FROM payloads ORDER BY id LIMIT 1"))[0].root_json;
      expect(root).toMatch(/^__CHUNKED__:/);
      const id = root.slice(12); expect(id).toMatch(/^chunk_[a-f0-9]+$/);
      let raw = "";
      const chunks = await rows(`SELECT chunk_index, length(chunk_data) AS n FROM content_chunks WHERE content_id = '${id}' ORDER BY chunk_index`);
      for (const chunk of chunks) {
        for (let start = 1; start <= chunk.n; start += 2000) raw += (await rows(`SELECT substr(chunk_data, ${start}, 2000) AS part FROM content_chunks WHERE content_id = '${id}' AND chunk_index = ${chunk.chunk_index}`))[0].part;
      }
      const decoded = JSON.parse(raw);
      expect(typeof decoded === "string" ? JSON.parse(decoded) : decoded).toEqual(native);
    }
  } finally { db.close(); }
});
