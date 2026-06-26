/**
 * GraphQL `<prefix>_execute` tool-description builder. Extracted from
 * graphql-execute-tool.ts (which hit the line cap). Takes a narrow input shape
 * (not the full options type) so there's no import cycle.
 */
export interface GraphqlDescriptionInput {
    prefix: string;
    apiName?: string;
    preamble?: string;
    fsDoNamespace?: unknown;
    /** True when the server wired a second REST upstream (restApiFetch) — surfaces
     *  api.get/api.post in the tool description so the model knows they're live. */
    hasRestApi?: boolean;
}
/**
 * Build the `<prefix>_execute` tool description. `apiSummary` is the GraphQL
 * schema summary (T2.2 — when introspection is available at registration this is
 * the real query-root/type/arg listing, otherwise a "use schema.queryRoot()"
 * placeholder).
 */
export declare function buildGraphqlExecuteDescription(input: GraphqlDescriptionInput, apiSummary: string): string;
//# sourceMappingURL=graphql-execute-description.d.ts.map