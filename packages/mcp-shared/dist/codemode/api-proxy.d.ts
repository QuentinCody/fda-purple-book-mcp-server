/**
 * API Proxy source — pure JS injected into V8 isolates.
 *
 * Provides:
 *   api.get(path, params)  — HTTP GET through server's fetch layer
 *   api.post(path, body, params) — HTTP POST
 *   api.query(dataAccessId, sql) — SQL query against staged data (alias for db.queryStaged)
 *   db.queryStaged(dataAccessId, sql) — SQL query against staged data
 *   db.stage(data, tableName?) — stage arbitrary data into SQLite, returns { data_access_id, ... }
 *
 * API keys never enter the isolate — all HTTP goes through the host's apiFetch.
 *
 * Large responses (>30KB) are auto-staged into SQLite. When this happens,
 * the result has `__staged: true` with a `data_access_id` and `schema`.
 * Code can either return the staging metadata for the caller to use query_data,
 * or use api.query()/db.queryStaged() to query the data in-band with SQL.
 */
/**
 * Returns the JS source string to inject into V8 isolates.
 * Relies on `codemode` proxy being available (from evaluator prefix).
 */
export declare function buildApiProxySource(): string;
/**
 * REST-capability override — injected into a GraphQL isolate (AFTER
 * {@link buildGraphqlProxySource}) when a server wires a SECOND, REST upstream
 * via `restApiFetch` (a hybrid GraphQL+REST Code Mode server). It REASSIGNS the
 * GraphQL proxy's throwing `api.get`/`api.post` stubs to real implementations
 * routed through the host `__api_proxy`, reusing the already-defined
 * `__wrapStaged` for auto-staged responses.
 *
 * It declares NO `var` — `api`, `db`, `gql`, and `__wrapStaged` already exist
 * from buildGraphqlProxySource, so redeclaring them in the same module scope is
 * a parse error. That is precisely why this is a slim mutating override and not
 * a second {@link buildApiProxySource} concatenation.
 */
export declare function buildRestApiOverrideSource(): string;
//# sourceMappingURL=api-proxy.d.ts.map