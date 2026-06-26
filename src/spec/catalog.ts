import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const purpleBookCatalog: ApiCatalog = {
    name: "FDA Purple Book",
    baseUrl: "https://purplebooksearch.fda.gov",
    version: "monthly",
    auth: "none",
    endpointCount: 1,
    notes:
        "- FDA Purple Book: licensed BIOLOGICAL products — reference biologics, biosimilars, and interchangeables (complements the Orange Book, which is small-molecule only).\n" +
        "- NO live upstream API; data is the monthly Purple Book CSV, parsed and cached in-memory (24h TTL). One endpoint: /products.\n" +
        "- Filters are case-insensitive substring matches on ANY column (snake_case). Unlisted columns are filterable too; pass them as params.\n" +
        "- license_type values: '351(a)' (reference/originator), '351(k) Biosimilar', '351(k) Interchangeable'. center is 'CDER' or 'CBER'.\n" +
        "- Exclusivity attaches to the REFERENCE/interchangeable row, NOT the biosimilar row, and is sparse by design (generic 'exclusivity_expiration_date' is blank/legacy; use ref_product_/orphan_/first_interchangeable_ columns).\n" +
        "- Date columns also expose best-effort ISO variants '<col>_iso' (YYYY-MM-DD). After staging, run SQL on e.g. ref_product_exclusivity_exp_date_iso for exclusivity-cliff queries.\n" +
        "- Group biosimilars by ref_product_proper_name to see a reference product's competitors. ~2,200 product rows total.\n" +
        "- Use 'limit'/'offset' to paginate (default limit 500). source_url + retrieval are in the response. Not affiliated with or endorsed by FDA.",
    endpoints: [
        {
            method: "GET",
            path: "/products",
            summary:
                "Search FDA Purple Book licensed biological products. Filter by name, applicant, BLA number, license type (351(a)/biosimilar/interchangeable), reference product, center, or any column. Exclusivity-expiry queries: stage results, then SQL on the *_iso date columns.",
            category: "products",
            queryParams: [
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
