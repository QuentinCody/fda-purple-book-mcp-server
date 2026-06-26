import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { purpleBookCatalog } from "../spec/catalog";
import { createPurpleBookApiFetch } from "../lib/api-adapter";

/**
 * Interface matching what createSearchTool/createExecuteTool .register() expects.
 * The shared lib calls server.tool(name, description, schema, handler).
 */
interface ToolRegisterable {
    tool: (...args: unknown[]) => void;
}

function toRegisterable(server: McpServer): ToolRegisterable {
    return {
        tool(...args: unknown[]) {
            Function.prototype.apply.call(server.tool, server, args);
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
    const registerable = toRegisterable(server);

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
        doNamespace,
        loader,
    });
    executeTool.register(registerable);
}
