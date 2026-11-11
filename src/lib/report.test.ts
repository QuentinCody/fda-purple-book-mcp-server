import { expect, it } from "vitest";
import { parseCsv, parseReport } from "./report";

import { reportFixture } from "./report.fixture";

it("excludes the change-section copy but preserves two presentations of the same BLA", () => {
  const result = parseReport(reportFixture, "2026-08");
  expect(result.records).toHaveLength(2);
  expect(result.records.map(row => [row.bla_number, row.strength])).toEqual([["001234", "10 mg"], ["001234", "20 mg"]]);
  expect(result.changes).toEqual([{ bla_number: "001234", applicant: "Company, Inc.", strength: "10 mg", approval_date: "1-Aug-26", approval_date_iso: "2026-08-01", change: "U" }]);
  expect(result.reportPreamble).toEqual([["Purple Book August 2026"], ["Report date", "31-Aug-2026"]]);
  expect(result.sectionNotes.changes).toEqual([["Full database"]]);
});

it("honors quoted commas, multiline values, escaped quotes and BOM", () => {
  expect(parseCsv('\uFEFFa,b\r\n"x,y","multi\n""quote"""\r\n')).toEqual([["a", "b"], ["x,y", 'multi\n"quote"']]);
  expect(() => parseCsv('a,"unclosed')).toThrow("Unterminated");
});

it.each(["", "BLA Number,Applicant\n123,Company", reportFixture + "BLA Number,Applicant\n456,Other", reportFixture.replaceAll("Applicant,Strength", "Applicant,Applicant"), reportFixture.replaceAll("001234,", ",")])("rejects ambiguous or empty full snapshots %#", text => {
  expect(() => parseReport(text, "2026-08")).toThrow();
});

it("keeps raw impossible dates without inventing normalized calendar days", () => {
  const result = parseReport(reportFixture.replaceAll("1-Aug-26", "31-Feb-26"), "2026-08");
  expect(result.records[0].approval_date).toBe("31-Feb-26");
  expect(result.records[0]).not.toHaveProperty("approval_date_iso");
});

it("uses the selected historical year to interpret two-digit approval dates", () => {
  expect(parseReport(reportFixture.replaceAll("1-Aug-26", "1-Aug-99"), "2000-08").records[0].approval_date_iso).toBe("1999-08-01");
});

it("leaves two-digit dates unnormalized when the report month is unknown", () => {
  expect(parseReport(reportFixture, null).records[0]).not.toHaveProperty("approval_date_iso");
});

it("accepts an empty monthly change section without fabricating changes", () => {
  expect(parseReport(reportFixture.replace('001234,"Company, Inc.",10 mg,1-Aug-26,U\r\n', ""), "2026-08").changes).toEqual([]);
});

it("preserves source padding, identifier zeros and logical CSV record positions", () => {
  const text = reportFixture.replaceAll("10 mg", " 10 mg ").replaceAll("Company, Inc.", "Company, Inc. ");
  const result = parseReport(text, "2026-08");
  expect(result.records[0]).toMatchObject({ bla_number: "001234", applicant: "Company, Inc. ", strength: " 10 mg " });
  expect(result.nativeRows.products[0]).toEqual({ csv_record: 8, values: ["001234", "Company, Inc. ", " 10 mg ", "1-Aug-26", ""] });
  expect(result.nativeRows.changes[0].csv_record).toBe(4);
});

it("reads the observed legacy single-header shape without claiming monthly changes", () => {
  const text = 'Applicant,Proprietary Name,Proper Name,BLA Type,BLA Number,Approval Date\r\nCompany,Brand,proper,351(a),001234,12/31/2002\r\n';
  const result = parseReport(text, "2020-02");
  expect(result).toMatchObject({ layout: "full_snapshot_only", changesAvailable: false, changes: [], nativeHeaders: { changes: [] }, records: [{ bla_type: "351(a)", bla_number: "001234", approval_date: "12/31/2002", approval_date_iso: "2002-12-31" }] });
  expect(result.nativeRows.products[0].csv_record).toBe(2);
});

it.each(['a,b\n"one"suffix,two', 'a,b\nun"quoted,two', reportFixture.replace('20 mg,1-Feb-20,', '20 mg,1-Feb-20'), reportFixture.replace('20 mg,1-Feb-20,', '20 mg,1-Feb-20,,')])("rejects malformed quotes and product widths without losing evidence %#", text => {
  expect(() => parseReport(text, "2026-08")).toThrow();
});

it("preserves CRLF inside quoted cells and an empty final quoted field", () => {
  expect(parseCsv('a,b\r\n" x\r\ny ",""')).toEqual([["a", "b"], [" x\r\ny ", ""]]);
});
