# FDA Purple Book MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server exposing the **FDA Purple Book** — the database of licensed **biological products** (reference biologics, biosimilars, and interchangeables), with BLA numbers, applicants, approval dates, and exclusivity expiry. Complements `fda-orange-book-mcp-server` (small-molecule patents/exclusivity). One of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

```
https://fda-purple-book-mcp-server.quentincody.workers.dev/mcp
```

Local dev runs at `http://localhost:8903/mcp` (`./scripts/dev-servers.sh fda-purple-book`).

## Tools

- `purple_book_search` — discover endpoints (Code Mode catalog search)
- `purple_book_execute` — **Code Mode**: `api.get("/products", { ... })` in a V8 isolate
- `purple_book_query_data` — SQL over large responses auto-staged into per-session SQLite
- `purple_book_get_schema` — inspect a staged dataset's schema

Single endpoint `/products`; filter by `proprietary_name`, `proper_name`, `applicant`, `bla_number`, `license_type` (`351(a)` / `351(k) Biosimilar` / `351(k) Interchangeable`), `ref_product_proper_name`, `center`, or any column (case-insensitive substring). Date columns also expose `<col>_iso` (YYYY-MM-DD) — stage results then run SQL on e.g. `ref_product_exclusivity_exp_date_iso` for exclusivity-cliff queries. Every `_execute` result carries a `_meta.citation` (FDA Purple Book, U.S. Public Domain). *Not affiliated with or endorsed by FDA.*

## Architecture / maintenance

- **Archetype:** bulk — no live upstream API. `src/lib/http.ts` downloads the monthly Purple Book CSV (stable `fda.gov/media/182175/download`, with a dated-accessdata fallback) and caches it in-memory (24h TTL); `src/lib/api-adapter.ts` serves a synthetic `/products` surface over the cache. Large query results stage via the normal Code Mode >30KB path.
- **Drift risk:** low (column schema stable). **Refresh cadence:** monthly upstream; the 24h in-memory cache picks up new files automatically. **Known gaps:** generic `exclusivity_expiration_date` column is blank upstream (legacy); exclusivity attaches to the reference/interchangeable row, not the biosimilar row; `D-Mon-YY` 2-digit years parsed best-effort into `_iso` (raw retained).

## Development

```bash
./scripts/dev-servers.sh fda-purple-book
pnpm --filter fda-purple-book-mcp-server run deploy
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the build plan `docs/plans/2026-06-26-evidence-genomics-mcp-servers.md`.
