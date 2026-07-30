import { buildHealthResponse, configureCitationSigning } from "@bio-mcp/shared";
// FDA Purple Book MCP Server — Code Mode only.
// Tools: purple_book_search, purple_book_execute, purple_book_query_data, purple_book_get_schema
import { StatelessMcpWorker } from "@bio-mcp/shared/mcp";
import { McpServer } from "@bio-mcp/shared/mcp";
import { registerQueryData } from "./tools/query-data";
import { registerGetSchema } from "./tools/get-schema";
import { registerCodeMode } from "./tools/code-mode";
import { PurpleBookDataDO } from "./do";

export { PurpleBookDataDO };

export class MyMCP extends StatelessMcpWorker<Env> {
    server = new McpServer({
        name: "fda-purple-book",
        version: "0.1.0",
    });

    async init() {

    	configureCitationSigning(this.env);
        const env = this.env;
        registerQueryData(this.server, env);
        registerGetSchema(this.server, env);
        registerCodeMode(this.server, env);
    }
}

export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return buildHealthResponse("fda-purple-book");
        }

        if (url.pathname === "/mcp") {
            return MyMCP.serve("/mcp").fetch(request, env, ctx);
        }

        return new Response("Not found", { status: 404 });
    },
};
