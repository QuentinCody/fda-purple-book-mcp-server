import { expect, it } from "vitest";
import { reportControls, reportMetadata } from "./report-response";
import { parseReport } from "./report";
import { reportFixture } from "./report.fixture";

it.each([{ report_month: "2026-13" }, { report_month: "today" }, { expected_source_sha256: "invalid" }, { limit: -1 }, { offset: -1 }, { limit: 1.5 }, { limit: 10001 }])("rejects invalid report controls %#", params => {
  expect(() => reportControls(params)).toThrow();
});

it("separates report month, observation time and unknown currentness", () => {
  const report = reportMetadata({ ...parseReport(reportFixture, "2026-08"), reportMonth: "2026-08", discovery: "published_download_link", fetchedAt: Date.parse("2026-09-29T00:00:00Z"), sourceUrl: "https://www.accessdata.fda.gov/fixture.csv", sourceSha256: "a".repeat(64), rawCsv: reportFixture, sourceBytes: new TextEncoder().encode(reportFixture).length });
  expect(report).toMatchObject({ report_month: "2026-08", retrieved_at: "2026-09-29T00:00:00.000Z", latest_verified: false, product_row_count: 2, change_row_count: 1, layout: "changes_and_products", changes_available: true });
});
