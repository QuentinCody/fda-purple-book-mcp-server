import { type Citation, type SourceDescriptor } from "./provenance";
export interface PassthroughCitationArgs {
    /** Source descriptor; when absent, no citation is produced (returns {}). */
    source?: SourceDescriptor;
    /** Server alias, e.g. "civic". */
    server: string;
    /** Passthrough tool name, e.g. "civic_graphql_query". */
    tool: string;
    /** The request (query + variables) — hashed into query_hash. */
    query: unknown;
    /** The result bytes being cited (inline result, or the staged data). */
    result: unknown;
    recordCount?: number;
    dataAccessId?: string;
}
/**
 * Build the `_meta.citation` envelope for a passthrough result. Returns `{}`
 * when the server declares no source descriptor, so callers can spread it
 * unconditionally:
 *
 *   const cite = await buildPassthroughCitation({ source, server, tool, query, result });
 *   structuredContent: { ...data, _meta: { ...cite } }
 */
export declare function buildPassthroughCitation(args: PassthroughCitationArgs): Promise<{
    citation?: Citation;
}>;
//# sourceMappingURL=passthrough-citation.d.ts.map