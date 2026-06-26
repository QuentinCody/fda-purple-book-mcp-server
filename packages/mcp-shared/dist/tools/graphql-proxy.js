/**
 * Hidden __graphql_proxy tool — routes V8 isolate gql.query() calls
 * through the server's GraphQL fetch function.
 *
 * This tool is only callable from V8 isolates (hidden=true).
 * It executes GraphQL queries, handles errors, and auto-stages
 * large responses via stageToDoAndRespond().
 */
import { z } from "zod";
import { formatGqlValidationErrors, validateGraphqlQuery, } from "../codemode/graphql-validate";
import { effectiveStagingThreshold } from "../staging/single-record";
import { shouldStage, stageToDoAndRespond } from "../staging/utils";
import { buildStageOptions } from "./api-proxy";
import { buildStagedEnvelope } from "./staging-envelope";
/**
 * Try to auto-stage a large response into the DO.
 * Returns the staging envelope if staged, or undefined if not applicable.
 *
 * When `ctx.workspace` is set AND the server wired a `workspaceNamespace`,
 * staging is routed into the shared WorkspaceDO via {@link buildStageOptions}
 * (ADR-006 Phase 0). Otherwise the per-server DO path is used — unchanged. The
 * envelope (columns T3.3, filter_warning T1.3, preserved scalars) is built by
 * the shared {@link buildStagedEnvelope}, identical to the REST proxy. A SINGLE
 * record gets a raised threshold (T10.1) so a one-entity lookup stays inline.
 */
async function tryAutoStage(resultData, responseBytes, config, ctx) {
    if (!config.doNamespace ||
        !shouldStage(responseBytes, effectiveStagingThreshold(resultData, config.threshold))) {
        return undefined;
    }
    const staged = await stageToDoAndRespond(resultData, config.doNamespace, config.prefix, undefined, undefined, config.prefix, ctx?.sessionId, buildStageOptions(ctx, config.workspaceNamespace, config.prefix));
    return buildStagedEnvelope({
        staged,
        responseBytes,
        originalData: resultData,
    });
}
/**
 * Execute a GraphQL query and return the result, staging if needed.
 */
async function executeAndMaybeStage(gqlFetch, query, variables, staging, ctx) {
    const response = await gqlFetch(query, variables);
    // GraphQL errors without data — return error
    if (response.errors && !response.data) {
        const messages = response.errors.map((e) => e.message).join("; ");
        return { __gql_error: true, message: messages, errors: response.errors };
    }
    // Always return response.data directly for consistent shape.
    // If there are partial errors alongside data, attach them as a
    // non-enumerable __errors property so they don't pollute staging
    // but isolate code can still inspect them via result.__errors.
    const resultData = response.data ?? {};
    const responseBytes = JSON.stringify(resultData).length;
    const staged = await tryAutoStage(resultData, responseBytes, staging, ctx);
    const output = staged ?? resultData;
    // Attach partial errors if present (errors-only case is handled above)
    if (response.errors && output && typeof output === "object") {
        output.__errors = response.errors;
    }
    return output;
}
/**
 * Pre-flight validate a query against cached introspection (T1.2). Returns a
 * structured `__gql_error` envelope to short-circuit on confident errors, or
 * `undefined` to let the query proceed to `gqlFetch`.
 */
function preflightValidate(query, getIntrospection) {
    const introspection = getIntrospection?.();
    if (!introspection)
        return undefined;
    const verdict = validateGraphqlQuery(query, introspection);
    if (!verdict.checked || verdict.errors.length === 0)
        return undefined;
    return {
        __gql_error: true,
        code: "QUERY_VALIDATION",
        preflight: true,
        message: formatGqlValidationErrors(verdict.errors),
        errors: verdict.errors,
    };
}
/**
 * Build the handler function for the __graphql_proxy tool.
 */
function buildHandler(gqlFetch, staging, getIntrospection) {
    return async (input, ctx) => {
        const query = String(input.query || "");
        const variables = input.variables;
        if (!query) {
            return { __gql_error: true, message: "query is required", errors: [] };
        }
        // T1.2 — fail locally on a confidently-invalid query, zero upstream call.
        const preflight = preflightValidate(query, getIntrospection);
        if (preflight)
            return preflight;
        try {
            return await executeAndMaybeStage(gqlFetch, query, variables, staging, ctx);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { __gql_error: true, message, errors: [{ message }] };
        }
    };
}
/**
 * Create the hidden __graphql_proxy tool entry.
 */
export function createGraphqlProxyTool(options) {
    const staging = {
        doNamespace: options.doNamespace,
        prefix: options.stagingPrefix,
        threshold: options.stagingThreshold,
        workspaceNamespace: options.workspaceNamespace,
    };
    return {
        name: "__graphql_proxy",
        description: "Route GraphQL queries from V8 isolate through server fetch layer. Internal only.",
        hidden: true,
        schema: {
            query: z.string(),
            variables: z.record(z.string(), z.unknown()).optional(),
        },
        handler: buildHandler(options.gqlFetch, staging, options.getIntrospection),
    };
}
//# sourceMappingURL=graphql-proxy.js.map