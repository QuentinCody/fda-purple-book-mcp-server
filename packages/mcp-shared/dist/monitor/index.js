// interlinked-tdd: exempt -- re-export barrel, no testable surface
/** Monitoring primitive — public surface (engine + provenance ledger). */
export { canonicalValue, cleanResult, extractRowSets, KEY_SEP, keyedValueMap, reparse, resolvePath, rowKey, selectValueFields, snapshotHash, } from "./canonicalize";
export { diffSnapshots, diffTable } from "./diff";
export { buildToolCall, callTool, parseToolResult, } from "./internal-call";
export { autoDetectKey } from "./key-detect";
export { classifyChanges, defaultMateriality } from "./materiality";
export { runOnce, } from "./run-once";
export { appendSnapshot, buildSnapshotRow, computeEntryHash, GENESIS_HASH, verifyChainRows, verifySnapshotChain, } from "./snapshot-chain";
export { fdaOrangeBook, SOURCES } from "./sources/index";
//# sourceMappingURL=index.js.map