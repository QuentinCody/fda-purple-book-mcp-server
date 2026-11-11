import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reportFixture } from "./report.fixture";

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const csvUrl = "https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/2026/purplebook-search-August-data-download.csv";
const html = `<a href="${csvUrl}">CSV</a>`;

it("loads the newest advertised report and keeps its complete text hash through caching", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(html)).mockResolvedValueOnce(new Response(reportFixture)); vi.stubGlobal("fetch", fetcher);
  const { getPurpleBookData } = await import("./http");
  const first = await getPurpleBookData();
  expect(first).toMatchObject({ reportMonth: "2026-08", sourceUrl: csvUrl, discovery: "published_download_link", sourceSha256: createHash("sha256").update(reportFixture).digest("hex") });
  expect(await getPurpleBookData()).toBe(first);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never substitutes another report when an explicitly requested month is absent", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(html)); vi.stubGlobal("fetch", fetcher);
  const { getPurpleBookData } = await import("./http");
  await expect(getPurpleBookData("2026-09")).rejects.toThrow("not advertised");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("keeps discovery failures explicit instead of fetching the invalid legacy media fallback", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  const { getPurpleBookData } = await import("./http");
  await expect(getPurpleBookData()).rejects.toThrow("503");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("https://purplebooksearch.fda.gov/downloads");
});

it("rejects malformed months before fetching", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const { getPurpleBookData } = await import("./http");
  await expect(getPurpleBookData("2026-13")).rejects.toThrow("YYYY-MM");
  expect(fetcher).not.toHaveBeenCalled();
});

it("refreshes the advertised report after the 24-hour cache expires", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29"));
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(url.endsWith("/downloads") ? html : reportFixture)); vi.stubGlobal("fetch", fetcher);
  const { getPurpleBookData } = await import("./http");
  const first = await getPurpleBookData();
  vi.setSystemTime(new Date("2026-09-30"));
  expect((await getPurpleBookData()).fetchedAt).toBeGreaterThan(first.fetchedAt);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
