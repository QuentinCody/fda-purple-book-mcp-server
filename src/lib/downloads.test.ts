import { afterEach, expect, it, vi } from "vitest";
import { discoverReleases, readFdaText } from "./downloads";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const base = "https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/2026/";

it("discovers dated official CSV links and orders report months, not page order", () => {
  const html = `<a href="${base}purplebook-search-January-data-download.csv">CSV</a><a href="${base}purplebook-search-August-data-download.csv">CSV</a><a href="${base}purplebook-search-August-data-download.xlsx">XLSX</a>`;
  expect(discoverReleases(html)).toEqual([{ report_month: "2026-08", source_url: base + "purplebook-search-August-data-download.csv" }, { report_month: "2026-01", source_url: base + "purplebook-search-January-data-download.csv" }]);
});

it.each(["<html>challenge</html>", `<a href="${base.replace("www.accessdata.fda.gov", "attacker.example")}purplebook-search-August-data-download.csv">CSV</a>`, `<a href="${base}purplebook-search-Nonesuch-data-download.csv">CSV</a>`])("rejects pages without recognized official report links %#", html => {
  expect(() => discoverReleases(html)).toThrow();
});

it("rejects competing files for the same report month", () => {
  expect(() => discoverReleases(`<a href="${base}purplebook-search-August-data-download.csv">CSV</a><a href="${base}purplebook-search-aug-data-download.csv">CSV</a>`)).toThrow("Conflicting");
});

it("bounds download size in bytes and rejects provider errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("α".repeat(4200000))).mockResolvedValueOnce(new Response("missing", { status: 404 })));
  await expect(readFdaText(base)).rejects.toThrow("8 MiB");
  await expect(readFdaText(base)).rejects.toThrow("404");
});

it("bounds a stalled response body", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} }))));
  const pending = expect(readFdaText(base)).rejects.toThrow("15 seconds");
  await vi.advanceTimersByTimeAsync(15000); await pending;
});

it("follows only bounded FDA redirects and preserves BOM bytes for hashing", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: base } })).mockResolvedValueOnce(new Response("\uFEFFa,b\r\n"));
  vi.stubGlobal("fetch", fetcher);
  expect(await readFdaText("https://www.fda.gov/media/182175/download")).toBe("\uFEFFa,b\r\n");
  expect(fetcher.mock.calls[1][0]).toBe(base);
  expect(fetcher.mock.calls[1][1].headers.Accept).toContain("application/octet-stream");
});

it("does not follow redirects outside FDA", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://attacker.example" } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(readFdaText(base)).rejects.toThrow("Untrusted");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
