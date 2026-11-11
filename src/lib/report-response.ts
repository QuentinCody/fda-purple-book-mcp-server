import { z } from "zod";
import type { PurpleBookData } from "./http";

const controls = z.object({
  report_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  expected_source_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
}).passthrough();

export function reportControls(params: Record<string, unknown>): z.infer<typeof controls> {
  const parsed = controls.safeParse(params);
  if (!parsed.success) throw new Error("Use report_month YYYY-MM, optional expected_source_sha256, limit 1–10000, and nonnegative offset");
  return parsed.data;
}

export function reportMetadata(data: PurpleBookData): Record<string, unknown> {
  return { report_month: data.reportMonth, report_month_source: data.discovery,
    retrieved_at: new Date(data.fetchedAt).toISOString(), source_url: data.sourceUrl,
    source_sha256: data.sourceSha256, hash_scope: "UTF-8 CSV text including BOM and line endings as received",
    source_bytes: data.sourceBytes, layout: data.layout, changes_available: data.changesAvailable,
    report_preamble: data.reportPreamble, native_headers: data.nativeHeaders, section_notes: data.sectionNotes,
    product_row_count: data.records.length, change_row_count: data.changesAvailable ? data.changes.length : null,
    latest_verified: false,
    interpretation: "Report month comes from FDA's published link, not product approval dates or retrieval time. Default selection uses the newest advertised link observed when loaded, cached for 24h. File hashes detect revisions; they are not FDA signatures. Changes are separate from the full snapshot. Multiple presentations can share a BLA." };
}
