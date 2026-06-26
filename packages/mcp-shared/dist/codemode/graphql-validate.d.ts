/**
 * Conservative pre-flight GraphQL query validation (T1.2).
 *
 * Given a {@link TrimmedIntrospection} schema and a query string, walk the
 * query's selection tree and report the high-frequency mistakes the demo
 * surfaced — unknown field on a type, unknown/rejected argument, and missing
 * required argument — BEFORE the query is sent upstream. This kills the whole
 * "guess the GraphQL shape, get a 500, retry the same broken query" class
 * (dgidb / civic / gnomad / opentargets) locally, with a precise correction.
 *
 * DESIGN BIAS — never false-positive. A false "this field is invalid" would
 * BLOCK a valid query, which is worse than the status quo. So the validator is
 * deliberately conservative:
 *   - It returns `{ checked: false }` (and reports nothing) the moment it meets
 *     anything it can't reason about confidently: a parse it can't complete, a
 *     named fragment spread (adds fields we can't see), a field whose return
 *     type isn't an object/interface/union we can resolve, etc.
 *   - It only reports an error when the offending field/arg is written
 *     explicitly in the query AND the schema unambiguously lacks it.
 * Callers MUST only block when `checked === true && errors.length > 0`.
 */
import type { TrimmedIntrospection } from "./graphql-introspection";
export interface GqlValidationError {
    /** The type the offending selection was made on. */
    type: string;
    /** The field (or field.arg) at fault. */
    field: string;
    message: string;
}
export interface GqlValidationResult {
    /** True only if the query was fully parsed and walked. False → don't block. */
    checked: boolean;
    errors: GqlValidationError[];
}
/**
 * Decide whether an operation is a mutation by scanning past leading whitespace
 * and `#` comment lines to the first keyword. Linear scan (no backtracking regex)
 * so it can't ReDoS on adversarial input.
 */
export declare function isMutationOperation(query: string): boolean;
/**
 * Validate a GraphQL query against trimmed introspection. Conservative — see the
 * file header. Returns `{ checked: false }` whenever it can't reason confidently.
 */
export declare function validateGraphqlQuery(query: string, introspection: TrimmedIntrospection): GqlValidationResult;
/** One-line human summary of validation errors, for an error envelope message. */
export declare function formatGqlValidationErrors(errors: GqlValidationError[]): string;
//# sourceMappingURL=graphql-validate.d.ts.map