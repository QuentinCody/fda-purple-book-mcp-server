/**
 * API drift detection for the `__api_proxy` tool.
 *
 * Extracted from `api-proxy.ts` (cohesive, self-contained, and the original file
 * was at the line cap). Given the server's known endpoints (catalog + OpenAPI
 * spec) and a failed request, {@link buildDriftHint} explains WHY it failed —
 * unknown endpoint, parameter mismatch, or an upstream contract change — so the
 * model can self-correct instead of blindly retrying.
 */
import type { ApiCatalog } from "../codemode/catalog";
import type { ResolvedSpec } from "../codemode/openapi-resolver";
type DriftHintKind = "unknown_endpoint" | "contract_changed" | "parameter_mismatch";
export interface DriftHint {
    kind: DriftHintKind;
    message: string;
    suggestions?: Array<{
        method: string;
        path: string;
        summary?: string;
    }>;
    expected_params?: string[];
    known_methods?: string[];
}
export interface KnownEndpoint {
    method: string;
    path: string;
    summary?: string;
    pathParamNames: string[];
    queryParamNames: string[];
}
export declare function buildKnownEndpointIndex(catalog?: ApiCatalog, openApiSpec?: ResolvedSpec): KnownEndpoint[];
/**
 * Pre-flight endpoint check (T1.1). Returns an `unknown_endpoint` {@link DriftHint}
 * when the request path is almost certainly a hallucination — i.e. it matches no
 * known endpoint for ANY method, yet a known endpoint shares its first path
 * segment (the model was "in the neighborhood" of a real endpoint but invented
 * the leaf, e.g. `/association/find` next to the documented `/association`).
 *
 * Returns `undefined` (→ let the call proceed to upstream) when:
 *   - there are no known endpoints (server passed no catalog/spec), or
 *   - the path DOES match a known endpoint path (any method — an undocumented
 *     method on a real path is allowed through), or
 *   - the path is wholly novel (no sibling under the same first segment), so we
 *     can't confidently call it a mistake — the reactive drift hint still fires
 *     on a real 404.
 *
 * This deliberately blocks only the high-confidence hallucination case to avoid
 * false-positives on curated catalogs that omit valid endpoints.
 */
export declare function preflightUnknownEndpoint(method: string, requestPath: string, knownEndpoints: KnownEndpoint[]): DriftHint | undefined;
export declare function buildDriftHint(method: string, requestPath: string, status: number, knownEndpoints: KnownEndpoint[]): DriftHint | undefined;
export {};
//# sourceMappingURL=api-proxy-drift.d.ts.map