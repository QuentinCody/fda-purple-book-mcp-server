/**
 * Single-record staging heuristic (T10.1).
 *
 * Staging is valuable for a LIST of many rows (query/aggregate via SQL). But a
 * SINGLE record (one UniProt entry, one gene) that merely happens to exceed the
 * 30KB threshold should NOT auto-stage — staging forces a needless
 * stage → get_schema → query round-trip just to read one field (the FOXP3 case:
 * a single UniProt entry auto-staged at `staged:4` on a 4-fact prompt). Instead,
 * a single record is returned inline up to near the 100KB structuredContent
 * transport limit.
 *
 * Detection is deliberately CONSERVATIVE: a response is treated as multi-row only
 * when a recognized collection key holds an array of >1 element (or the payload
 * itself is such an array). A single entity with large NESTED object-arrays
 * (UniProt `features`/`dbReferences`) is still a single record. Non-standard list
 * shapes fall back to the base threshold (no regression, just no improvement).
 */
/** True when the response represents ONE entity rather than a list of many. */
export declare function isSingleRecordResponse(data: unknown): boolean;
/**
 * The effective auto-stage byte threshold for a response: raised for single
 * records (so they stay inline), the base for multi-row lists. `baseThreshold`
 * defaults to the shared 30KB when omitted.
 */
export declare function effectiveStagingThreshold(data: unknown, baseThreshold: number | undefined): number;
//# sourceMappingURL=single-record.d.ts.map