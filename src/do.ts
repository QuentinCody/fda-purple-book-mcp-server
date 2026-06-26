import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class PurpleBookDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        if (Array.isArray(data)) {
            const sample = data[0];
            if (
                sample &&
                typeof sample === "object" &&
                "bla_number" in sample &&
                ("proprietary_name" in sample || "proper_name" in sample)
            ) {
                return {
                    tableName: "products",
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
                    ],
                };
            }
        }

        return undefined;
    }
}
