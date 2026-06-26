import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { getPurpleBookData } from "./http";

/** Case-insensitive substring match filter against record field names. */
function matchesFilter(
    records: Record<string, string>[],
    params: Record<string, unknown>,
): Record<string, string>[] {
    const filters = Object.entries(params).filter(
        ([key, val]) =>
            key !== "limit" && key !== "offset" && val !== undefined && val !== "",
    );
    if (filters.length === 0) return records;
    return records.filter((record) =>
        filters.every(([key, val]) => {
            const fieldValue = record[key];
            if (fieldValue === undefined) return false;
            return fieldValue.toLowerCase().includes(String(val).toLowerCase());
        }),
    );
}

function paginate(
    records: Record<string, string>[],
    params: Record<string, unknown>,
): Record<string, string>[] {
    const offset = Number(params.offset) || 0;
    const limit = Number(params.limit) || 500;
    return records.slice(offset, offset + limit);
}

/**
 * Create an ApiFetchFn for FDA Purple Book data.
 *
 * Route:
 *   GET /products — Search licensed biological products (biologics, biosimilars, interchangeables).
 *
 * All query parameters are case-insensitive substring filters against the
 * corresponding (snake_case) field names. Special params: limit, offset.
 */
export function createPurpleBookApiFetch(): ApiFetchFn {
    return async (request) => {
        const path = request.path.replace(/^\/+/, "").split("?")[0];
        const params = (request.params ?? {}) as Record<string, unknown>;

        if (!(path === "products" || path.startsWith("products/"))) {
            throw new Error(
                `Unknown Purple Book endpoint: /${path}. Valid endpoint: /products`,
            );
        }

        const { records, sourceUrl } = await getPurpleBookData();
        const filtered = matchesFilter(records, params);
        const results = paginate(filtered, params);

        return {
            status: 200,
            data: {
                total_unfiltered: records.length,
                total_filtered: filtered.length,
                returned: results.length,
                offset: Number(params.offset) || 0,
                limit: Number(params.limit) || 500,
                source_url: sourceUrl,
                results,
            },
        };
    };
}
