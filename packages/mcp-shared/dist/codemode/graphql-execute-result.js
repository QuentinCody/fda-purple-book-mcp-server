/**
 * Result handling for the GraphQL execute tool — turns a DynamicWorkerExecutor
 * result into an MCP code-mode response, attaching staging metadata and an
 * optional verifiable `_meta.citation`. Extracted from graphql-execute-tool.ts
 * (which hit the line cap); shared with the REST execute-tool pattern.
 */
import { buildCitation, } from "../provenance/provenance";
import { createCodeModeError, createCodeModeResponse, ErrorCodes, } from "./response";
/** Records returned, for the citation: staged total_rows, else array length. */
function countRecords(data, totalRows) {
    if (typeof totalRows === "number")
        return totalRows;
    if (Array.isArray(data))
        return data.length;
    return undefined;
}
/** Strip the large `schema`/`_staging` fields (available via get_schema) from a
 *  staged object and surface its staging-metadata fields. */
function slimStaged(obj) {
    const { schema: _s, _staging: _st, ...slim } = obj;
    return {
        slim,
        dataAccessId: obj.data_access_id,
        tablesCreated: obj.tables_created,
        totalRows: obj.total_rows,
    };
}
/** Build the optional `citation` meta when the server declared a source. */
async function buildCitationMeta(prov, data, recordCount, dataAccessId, retrievedAt) {
    if (!prov?.source)
        return {};
    const citation = await buildCitation({
        source: prov.source,
        server: prov.server,
        tool: prov.tool,
        query: prov.query,
        result: data,
        retrievedAt,
        recordCount,
        dataAccessId,
    });
    return { citation };
}
/** The isolate reported an error. If it was a staged-array access, recover the
 *  staging metadata; otherwise return a plain code-mode error. */
async function errorResult(result, prov, retrievedAt) {
    if (result.__stagedResults?.length) {
        const staged = result.__stagedResults[result.__stagedResults.length - 1];
        const { slim, dataAccessId, tablesCreated, totalRows } = slimStaged(staged);
        const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
        const cite = await buildCitationMeta(prov, slim, totalRows, dataAccessId, retrievedAt);
        return createCodeModeResponse(slim, {
            meta: {
                staged: true,
                data_access_id: dataAccessId,
                tables_created: tablesCreated,
                total_rows: totalRows,
                ...cite,
                ...(logOutput ? { console_output: logOutput } : {}),
                executed_at: retrievedAt,
            },
        });
    }
    const logOutput = result.logs?.length
        ? `\n\nConsole output:\n${result.logs.join("\n")}`
        : "";
    return createCodeModeError(ErrorCodes.API_ERROR, `${result.error}${logOutput}`);
}
/** The isolate succeeded. Detect an auto-staged return, slim it, and attach the
 *  optional citation + console output. */
async function successResult(result, prov, retrievedAt) {
    const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
    const raw = result.result;
    const isStaged = raw !== null &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        "__staged" in raw &&
        raw.__staged === true;
    let responseData = raw;
    const stagingMeta = {};
    if (isStaged) {
        const { slim, dataAccessId, tablesCreated, totalRows } = slimStaged(raw);
        stagingMeta.staged = true;
        stagingMeta.data_access_id = dataAccessId;
        stagingMeta.tables_created = tablesCreated;
        stagingMeta.total_rows = totalRows;
        responseData = slim;
    }
    const cite = await buildCitationMeta(prov, responseData, countRecords(responseData, stagingMeta.total_rows), stagingMeta.data_access_id, retrievedAt);
    return createCodeModeResponse(responseData, {
        meta: {
            ...stagingMeta,
            ...cite,
            ...(logOutput ? { console_output: logOutput } : {}),
            executed_at: retrievedAt,
        },
    });
}
/** Turn an executor result into an MCP code-mode response (success or error). */
export async function handleExecutorResult(result, prov) {
    const retrievedAt = new Date().toISOString();
    return result.error
        ? errorResult(result, prov, retrievedAt)
        : successResult(result, prov, retrievedAt);
}
//# sourceMappingURL=graphql-execute-result.js.map