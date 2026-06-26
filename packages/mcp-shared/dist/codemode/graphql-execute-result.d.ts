/**
 * Result handling for the GraphQL execute tool — turns a DynamicWorkerExecutor
 * result into an MCP code-mode response, attaching staging metadata and an
 * optional verifiable `_meta.citation`. Extracted from graphql-execute-tool.ts
 * (which hit the line cap); shared with the REST execute-tool pattern.
 */
import { type SourceDescriptor } from "../provenance/provenance";
/** Provenance context threaded from the factory options into result handling. */
export interface CitationCtx {
    source?: SourceDescriptor;
    server: string;
    tool: string;
    query: unknown;
}
/** The raw shape returned by DynamicWorkerExecutor.execute(). */
interface ExecutorResult {
    result?: unknown;
    error?: string;
    logs?: string[];
    __stagedResults?: Array<Record<string, unknown>>;
}
/** Turn an executor result into an MCP code-mode response (success or error). */
export declare function handleExecutorResult(result: ExecutorResult, prov?: CitationCtx): Promise<import("./response").CodeModeResponse<import("./response").ErrorResponse> | import("./response").CodeModeResponse<import("./response").SuccessResponse<unknown>> | import("./response").CodeModeResponse<import("./response").SuccessResponse<Record<string, unknown>>>>;
export {};
//# sourceMappingURL=graphql-execute-result.d.ts.map