import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class PurpleBookDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        const wrapped = "results" in data && Array.isArray(data.results) ? data.results : undefined;
        const records = wrapped ?? (Array.isArray(data) ? data : undefined);
        if (records) {
            const sample = records[0];
            if (
                sample &&
                typeof sample === "object" &&
                "bla_number" in sample &&
                "applicant" in sample
            ) {
                return {
                    ...(wrapped ? {} : { tableName: "products" }),
                    columnTypes: Object.fromEntries(Object.keys(sample).map(key => [key, "TEXT"])),
                    indexes: [
                        "bla_number",
                        "proprietary_name",
                        "proper_name",
                        "applicant",
                        "license_type",
                        "center",
                        "marketing_status",
                        "ref_product_proper_name",
                        "product_number",
                    ].filter(column => column in sample),
                };
            }
        }

        return undefined;
    }
}
