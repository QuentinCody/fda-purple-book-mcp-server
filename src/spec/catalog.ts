import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";
import { reportEndpoints, reportParams, reportWorkflows } from "./reports";

export const purpleBookCatalog: ApiCatalog = {
    name: "FDA Purple Book",
    baseUrl: "https://purplebooksearch.fda.gov",
    version: "monthly",
    auth: "none",
    endpointCount: 4,
    notes:
        "- FDA Purple Book: licensed BIOLOGICAL products — reference biologics, biosimilars, and interchangeables (complements the Orange Book, which is small-molecule only).\n" +
        "- File-backed API over FDA monthly CSV reports (24h cache). /releases discovers published links; /report returns provenance; /products is the full snapshot; /changes is a separate change section.\n" +
        "- Filters are case-insensitive substring matches on ANY column (snake_case). Unlisted columns are filterable too; pass them as params.\n" +
        "- license_type values: '351(a)' (reference/originator), '351(k) Biosimilar', '351(k) Interchangeable'. center is 'CDER' or 'CBER'.\n" +
        "- Exclusivity attaches to the REFERENCE/interchangeable row, NOT the biosimilar row, and is sparse by design (generic 'exclusivity_expiration_date' is blank/legacy; use ref_product_/orphan_/first_interchangeable_ columns).\n" +
        "- Date columns also expose best-effort ISO variants '<col>_iso' (YYYY-MM-DD). After staging, run SQL on e.g. ref_product_exclusivity_exp_date_iso for exclusivity-cliff queries.\n" +
        "- Group biosimilars by ref_product_proper_name. Do not deduplicate by BLA: distinct strengths/presentations can share an application.\n" +
        "- Preserve native whitespace and identifier zeros. row_sources retains one-based CSV record positions and original cell arrays; /report retains exact raw_csv including BOM/line endings. Native SQL columns are TEXT.\n" +
        "- Headers vary by report: older files use bla_type instead of license_type and may use mkt_status instead of marketing_status. Inspect native_headers. Single-section archives expose products but no monthly changes.\n" +
        "- Pages also stop at 2 MiB of row data. Follow next_offset; the final offset page remains incomplete relative to the whole selection.\n" +
        "- Use limit/offset (1–10000, default 500). Keep report_month and expected_source_sha256 fixed across pages; do not append /changes to /products. Native report date text, file hash and retrieval time are retained. Discovery failures remain explicit; no unadvertised media fallback is used. Not affiliated with or endorsed by FDA.",
    workflows: reportWorkflows,
    endpoints: [
        ...reportEndpoints,
        {
            method: "GET",
            path: "/products",
            summary:
                "Search FDA Purple Book licensed biological products. Filter by name, applicant, BLA number, license type (351(a)/biosimilar/interchangeable), reference product, center, or any column. Exclusivity-expiry queries: stage results, then SQL on the *_iso date columns.",
            category: "products",
            queryParams: [
                ...reportParams,
                { name: "proprietary_name", type: "string", required: false, description: "Brand/proprietary name (e.g. 'Humira')" },
                { name: "proper_name", type: "string", required: false, description: "Proper/nonproprietary name (e.g. 'adalimumab')" },
                { name: "applicant", type: "string", required: false, description: "Applicant/sponsor company (e.g. 'Amgen')" },
                { name: "bla_number", type: "string", required: false, description: "BLA (Biologics License Application) number" },
                { name: "license_type", type: "string", required: false, description: "BLA pathway: '351(a)', '351(k) Biosimilar', or '351(k) Interchangeable'" },
                { name: "marketing_status", type: "string", required: false, description: "Marketing status (e.g. 'Prescription', 'Disc')" },
                { name: "center", type: "string", required: false, description: "FDA review center: 'CDER' or 'CBER'", enum: ["CDER", "CBER"] },
                { name: "ref_product_proper_name", type: "string", required: false, description: "Reference product proper name (group biosimilars by this)" },
                { name: "ref_product_proprietary_name", type: "string", required: false, description: "Reference product proprietary/brand name" },
                { name: "strength", type: "string", required: false, description: "Product strength" },
                { name: "dosage_form", type: "string", required: false, description: "Dosage form" },
                { name: "route_of_administration", type: "string", required: false, description: "Route of administration" },
                { name: "limit", type: "number", required: false, description: "Max results to return (default: 500)" },
                { name: "offset", type: "number", required: false, description: "Number of results to skip (default: 0)" },
            ],
        },
    ],
};
