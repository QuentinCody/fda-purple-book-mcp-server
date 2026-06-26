import { describe, expect, it, vi } from "vitest";

// Capture what the (mocked) executor is handed, so we can assert the isolate
// source + host fn-map reflect the hybrid GraphQL+REST wiring.
const captured = vi.hoisted(
	(): { code: string; fns: Record<string, unknown> } => ({
		code: "",
		fns: {},
	}),
);

vi.mock("./execute-tool", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./execute-tool")>();
	return {
		...actual,
		DynamicWorkerExecutor: class {
			constructor(_opts: unknown) {}
			async execute(code: string, fns: Record<string, unknown>) {
				captured.code = code;
				captured.fns = fns;
				return { result: { ok: true } };
			}
		},
	};
});

import { createGraphqlExecuteTool } from "./graphql-execute-tool";
import type { TrimmedIntrospection } from "./graphql-introspection";

// Minimal pre-cached introspection so the factory skips the network fetch.
const introspection: TrimmedIntrospection = {
	queryType: { name: "Query" },
	types: [{ name: "Query", kind: "OBJECT", fields: [] }],
};

type Handler = (input: { code: string }, extra: unknown) => Promise<unknown>;

function build(withRest: boolean) {
	return createGraphqlExecuteTool({
		prefix: "rcsb_pdb",
		gqlFetch: async () => ({ data: {} }),
		loader: { get: () => ({}) },
		introspection,
		...(withRest
			? { restApiFetch: async () => ({ status: 200, data: {} }) }
			: {}),
	});
}

async function runHandler(tool: ReturnType<typeof build>): Promise<unknown> {
	let handler: Handler | undefined;
	tool.register({
		tool: (...args: unknown[]) => {
			// SAFETY: register() always calls server.tool(name, description, schema, handler) — arg 3 is the handler.
			handler = args[3] as Handler;
		},
	});
	if (!handler) throw new Error("handler was not registered");
	return handler({ code: "return 1" }, {});
}

describe("createGraphqlExecuteTool with restApiFetch (hybrid GraphQL+REST)", () => {
	it("injects the REST capability + registers __api_proxy when restApiFetch is set", async () => {
		captured.code = "";
		captured.fns = {};
		const tool = build(true);
		// Description surfaces the REST surface to the model.
		expect(tool.description).toContain("api.get(path, params)");

		await runHandler(tool);
		// The wrapped isolate source carries the REST override (reassigned api.post).
		expect(captured.code).toContain("REST capability");
		expect(captured.code).toContain("api.post = async function");
		// The host fn-map gained the __api_proxy bridge, alongside the GraphQL proxy.
		expect(Object.keys(captured.fns)).toContain("__api_proxy");
		expect(Object.keys(captured.fns)).toContain("__graphql_proxy");
	});

	it("stays pure-GraphQL (no REST override, no __api_proxy) without restApiFetch", async () => {
		captured.code = "";
		captured.fns = {};
		const tool = build(false);
		expect(tool.description).not.toContain("api.get(path, params)");

		await runHandler(tool);
		expect(captured.code).not.toContain("REST capability");
		expect(Object.keys(captured.fns)).not.toContain("__api_proxy");
		expect(Object.keys(captured.fns)).toContain("__graphql_proxy");
	});
});
