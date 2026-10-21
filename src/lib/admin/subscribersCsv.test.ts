import { describe, expect, it } from "vitest";
import { CSV_HEADERS, csvFilename, csvText, filterSubscribers, toCsvRows } from "./subscribersCsv";
import type { SubscriberInput } from "./subscribersCsv";

const NOW = Date.UTC(2026, 9, 17, 12);

const subs: SubscriberInput[] = [
  { _id: "a", variantId: "0880-black", contact: "ana@example.com", channel: "email", name: "Ana López", locale: "es", createdAt: NOW, variantNameEn: "0880 Black", variantNameEs: "0880 Negro" },
  { _id: "b", variantId: "gothic-skull", contact: "+15550100", channel: "whatsapp", locale: "en", createdAt: NOW - 1000, variantNameEn: "Gothic Skull", variantNameEs: "Calavera Gótica" },
];

describe("filterSubscribers", () => {
  it("filters by product and by text across contact, name and product names", () => {
    expect(filterSubscribers(subs, { q: "", variantId: "all" })).toHaveLength(2);
    expect(filterSubscribers(subs, { q: "", variantId: "gothic-skull" }).map((s) => s._id)).toEqual(["b"]);
    expect(filterSubscribers(subs, { q: "ANA", variantId: "all" }).map((s) => s._id)).toEqual(["a"]);
    expect(filterSubscribers(subs, { q: "calavera", variantId: "all" }).map((s) => s._id)).toEqual(["b"]);
    expect(filterSubscribers(subs, { q: "5550", variantId: "all" }).map((s) => s._id)).toEqual(["b"]);
    expect(filterSubscribers(subs, { q: "nobody", variantId: "all" })).toEqual([]);
  });
});

describe("csv", () => {
  it("rows carry the localized product name and an ISO date", () => {
    expect(toCsvRows(subs, "es")[0]).toEqual(["ana@example.com", "email", "Ana López", "0880 Negro", "0880-black", new Date(NOW).toISOString(), "es"]);
    expect(toCsvRows(subs, "en")[1][3]).toBe("Gothic Skull");
    expect(toCsvRows(subs, "en")[1][2]).toBe("");
  });

  it("quotes fields with commas, quotes and newlines", () => {
    const text = csvText([["O'Brien, \"Big\" Jim\nJr", "plain"]]);
    expect(text.split("\r\n")[1]).toBe('"O\'Brien, ""Big"" Jim\nJr",plain');
  });

  it("neutralises spreadsheet formulas in subscriber-typed fields", () => {
    const text = csvText([['=HYPERLINK("x")', "+15550100", "-1", "@cmd", "plain"]]);
    expect(text.split("\r\n")[1]).toBe(`"'=HYPERLINK(""x"")",'+15550100,'-1,'@cmd,plain`);
  });

  it("text starts with a BOM, then the headers, and uses CRLF", () => {
    const text = csvText([["x", "y"]]);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.slice(1).split("\r\n")[0]).toBe(CSV_HEADERS.join(","));
  });

  it("filename carries the date", () => {
    expect(csvFilename(NOW)).toBe("good-luck-drop-subscribers-2026-10-17.csv");
  });
});
