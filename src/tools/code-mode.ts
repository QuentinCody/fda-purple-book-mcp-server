import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { purpleBookCatalog } from "../spec/catalog";
import { createPurpleBookApiFetch } from "../lib/api-adapter";
import { purpleBookResponse } from "../lib/tool-result";

/**
 * Interface matching what createSearchTool/createExecuteTool .register() expects.
 * The shared lib calls server.tool(name, description, schema, handler).
 */
interface ToolRegisterable {
    tool: (...args: unknown[]) => void;
}

function toRegisterable(server: McpServer, env: CodeModeEnv): ToolRegisterable {
    return {
        tool(...args: unknown[]) {
            const [base, ...rest] = args;
            const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof purpleBookResponse>;
            for (const name of [String(base), `mcp_${String(base)}`]) {
                const respond = (input: unknown, extra: unknown) => purpleBookResponse(() => handler(input, extra), env, name, extra, input);
                Function.prototype.apply.call(server.tool, server, [name, ...rest, respond]);
            }
        },
    };
}

/** Minimal shape required from the worker Env for Code Mode registration. */
interface CodeModeEnv {
    PURPLE_BOOK_DATA_DO: Pick<Env["PURPLE_BOOK_DATA_DO"], "get" | "idFromName">;
    CODE_MODE_LOADER: Env["CODE_MODE_LOADER"];
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
    const doNamespace = env.PURPLE_BOOK_DATA_DO;
    const loader = env.CODE_MODE_LOADER;

    if (!doNamespace || !loader) return;

    const apiFetch = createPurpleBookApiFetch();
    const registerable = toRegisterable(server, env);

    const searchTool = createSearchTool({
        prefix: "purple_book",
        catalog: purpleBookCatalog,
    });
    searchTool.register(registerable);

    const executeTool = createExecuteTool({
        prefix: "purple_book",
        // Verifiable provenance: purple_book_execute results carry a _meta.citation.
        source: { id: "purple_book", name: "FDA Purple Book", url: "https://purplebooksearch.fda.gov", license: "U.S. Public Domain" },
        catalog: purpleBookCatalog,
        apiFetch,
        preserveApiErrors: true,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        timeout: 60000,
        doNamespace,
        loader,
    });
    executeTool.register(registerable);
}
