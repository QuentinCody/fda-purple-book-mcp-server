# FDA Purple Book MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server exposing the **FDA Purple Book** — the database of licensed **biological products** (reference biologics, biosimilars, and interchangeables), with BLA numbers, applicants, approval dates, and exclusivity expiry. Complements `fda-orange-book-mcp-server` (small-molecule patents/exclusivity). Part of the [Bio MCP](../../README.md) monorepo.

## Connect

Configured production endpoint; the changes below have been validated locally
and have not been deployed:

```
https://fda-purple-book-mcp-server.quentincody.workers.dev/mcp
```

Local dev runs at `http://localhost:8903/mcp` (`./scripts/dev-servers.sh fda-purple-book`).

## Tools

- `purple_book_search` — discover endpoints (Code Mode catalog search)
- `purple_book_execute` — **Code Mode**: `api.get("/products", { ... })` in a V8 isolate
- `purple_book_query_data` — SQL over large responses auto-staged into per-session SQLite
- `purple_book_get_schema` — inspect a staged dataset's schema

All four tools register bare and `mcp_` aliases. `/products` supports filters on `proprietary_name`, `proper_name`, `applicant`, `bla_number`, `license_type`, `ref_product_proper_name`, `center`, or any column (case-insensitive substring). Date columns retain raw values and expose best-effort `<col>_iso` values when interpretable. Every `_execute` result carries a `_meta.citation`. *Not affiliated with or endorsed by FDA.*

## Report provenance and monthly changes

[FDA's downloads page](https://purplebooksearch.fda.gov/downloads) explains that each report contains monthly changes followed by the complete product snapshot. `/products` uses only the full section; `/changes` exposes the first section separately. Do not append the changes to the products or deduplicate products by BLA: different strengths and presentations may share the same application number.

```javascript
const discovery = await api.get("/releases");
const report_month = discovery.latest_report_month;
if (!report_month) return discovery;
const report = await api.get("/report", { report_month });
if (!report.source_sha256) return report;
return await api.get("/products", {
  report_month,
  expected_source_sha256: report.source_sha256,
  limit: 100,
  offset: 0
});
```

Use the same month and hash on every subsequent page. `/report` retains exact
`raw_csv` text, including BOM and line endings, native preamble/date text, section
headers and notes, product/change counts, the downloaded CSV hash and retrieval
time. It usually stages; its small `source_sha256` remains available on the
staging envelope for the recipe above. Product and change responses include
report context and aligned `row_sources`, containing original cell arrays and
one-based logical CSV record positions. Native U/N/R classifications remain in
`n_r_u` for the observed recent reports, without applying incremental updates.

Native field values retain whitespace, blank strings, precision and identifier
zeros. Keys are normalized to snake_case; `report.native_headers` retains the
original labels and order. Headers vary across archives: December 2025 uses
`bla_type`, August 2026 uses `license_type`, and February 2020 uses `mkt_status`
instead of `marketing_status`. Unsupported field names fail explicitly.
Historical single-header files expose their full product snapshot, with
`changes_available: false` and `change_row_count: null`; `/changes` returns an
explicit unavailable error for those files.

Pages stop at the requested row limit or 2 MiB of row data. Follow `next_offset`
until null. An offset page remains incomplete relative to the entire matching
selection, including its last page. Staged native columns use SQLite TEXT; the
usual page table is `results`. `payloads` and ordered `content_chunks` retain the
complete original response for lossless recovery.

`report_month` comes from an advertised dated CSV link; it is separate from product approval dates and retrieval time. Omitting it selects the newest advertised report when loaded, cached for 24 hours. Explicitly requested months never fall back to another release. Discovery failures remain explicit. The former media fallback serves a PDF, not Purple Book CSV, and is no longer used. No result claims independently verified currentness. A file hash detects revisions; it is not an FDA signature or an immutable archive guarantee.

## Architecture / maintenance

- File-backed reads use `/releases`, `/report`, `/products` and `/changes`; no new FDA query API is assumed. Published links replace guessed monthly URLs. Each request/body has a 15-second deadline and 8 MiB cap; redirects stay on approved FDA hosts. The 24-hour cache holds at most 12 entries and 4 MiB of combined source text; larger reports are served without caching.
- Ambiguous section/header layouts, malformed CSV quoting, mismatched product widths and empty full snapshots fail explicitly. Raw values and report notes remain available. Derived ISO dates are additional fields: two-digit approval years use the selected report year. Native slash dates use month/day/four-digit-year. Product-specific exclusivity semantics still require the native column context.
- Complete Code Mode, search, SQL and schema response envelopes stage above 30 KiB, including errors and composed results. Both aliases carry caller-bound citations. `limit` is 1–10000 (default 500), and `offset` must be nonnegative.

## Local acceptance — October 3, 2026

The observed FDA downloads page contains 79 CSV links, with August 2026 the
newest advertised month. Independent Python CSV parsing and the actual local
Worker agree on these complete sections:

| Report | Product rows | Change rows | Native columns |
| --- | ---: | ---: | ---: |
| August 2026 | 2,242 | 29 | 28 |
| December 2025 | 2,160 | 30 | 25 |
| February 2020 | 89 | unavailable | 20 |

All **4,550 rows / 120,118 native cells** match through MCP and staged SQL,
including padding, repeated BLA presentations and leading zeros. Exact CSV text
recovery matches every downloaded file's SHA-256. Both aliases pass discovery,
the published recipe, field filters, paging, wrong-hash and missing-month errors,
historical change unavailability, program-error recovery and an 80,000-byte
Unicode SQL result. The 66 server tests and full suite (13,179 passing tests,
109 skipped) pass. See the
[implementation tracker](../../docs/plans/2026-09-26-upstream-api-implementation.md)
for transport/citation evidence and affected-workspace checks.

Reproduction scripts are in `scratch/2026-10-03-purple-book/`; downloaded files
and the independent oracle are in `/tmp/purple-book-native/`. These checks qualify
the three observed reports. Other historical files and production remain
unverified; no deployment occurred.

## Development

```bash
./scripts/dev-servers.sh fda-purple-book
pnpm --filter fda-purple-book-mcp-server run deploy
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the build plan `docs/plans/2026-06-26-evidence-genomics-mcp-servers.md`.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from FDA Purple Book and stays under the terms of that source: US public domain.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
