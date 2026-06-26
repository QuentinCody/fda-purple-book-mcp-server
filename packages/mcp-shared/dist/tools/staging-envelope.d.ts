/**
 * Shared staging-envelope helpers — extracted from api-proxy.ts (which hit the
 * line cap) and deduplicated with graphql-proxy.ts, which carried byte-identical
 * copies. Both the REST (`__api_proxy`) and GraphQL (`__graphql_proxy`) auto-stage
 * paths build the same `{__staged, data_access_id, columns, message, …}` envelope.
 */
import { type FilterWarning } from "../completeness";
import type { StageResult } from "../staging/utils";
/**
 * Copy small scalar properties from the original API response onto the staging
 * metadata object. This preserves values like `.count`, `.total`, `.schema`,
 * `.paging_info` so LLM code can read them without an extra round-trip
 * (ADR-004 Option C). Never clobbers an existing envelope field.
 */
export declare function preserveEnvelopeScalars(original: unknown, staging: Record<string, unknown>): void;
/**
 * Compact `{ table: [col, …] }` map extracted from a staged dataset's schema.
 *
 * Surfaced on the staging envelope (T3.3) so the model learns the staged column
 * names from the SAME response that staged the data — no PRAGMA / sqlite_master
 * round-trip, and no column-name guessing (the recurring `no such column: NCTId`
 * failure where staging snake_cases the API field). Returns undefined when the
 * schema carries no recognizable tables.
 */
export declare function extractStagedColumns(schema: unknown): Record<string, string[]> | undefined;
/**
 * Build a human-readable summary of staged tables for the message field.
 * Example: "2 tables: transcript [10 rows], transcript_Exon [271 rows]"
 */
export declare function buildStagedTableSummary(staged: StageResult): string;
export interface StagedEnvelopeInput {
    staged: StageResult;
    responseBytes: number;
    /** The original upstream payload — small scalar siblings are preserved onto the
     *  envelope, and (unless `overMatch` is supplied) it is scanned for a silent
     *  over-match (Finding #2 / T1.3). */
    originalData: unknown;
    /** Pre-computed over-match warning; defaults to detectOverMatch(originalData). */
    overMatch?: FilterWarning;
}
/**
 * Build the standard auto-stage response envelope, shared by the REST and GraphQL
 * proxies. Carries `columns` (T3.3), an `INCOMPLETE` note when the staged set is
 * under-counted (completeness), a `filter_warning` when the upstream filter
 * silently over-matched (T1.3), and the preserved scalar siblings of the payload.
 */
export declare function buildStagedEnvelope(input: StagedEnvelopeInput): Record<string, unknown>;
//# sourceMappingURL=staging-envelope.d.ts.map