import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { SUPPORT_EMAIL as EMAIL_SUPPORT_ADDRESS } from "../../convex/notifications/orderEmails";
import { buildSitemap, NONE_LIVE } from "./seo/sitemap";
import { countItems, formatLastUpdated, LEGAL_LAST_UPDATED, LEGAL_SECTIONS, SUPPORT_EMAIL } from "./legal";

/** Every key path in a message tree; arrays count as one leaf per item so lengths must match. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

const DOCS = ["terms", "privacy"] as const;

describe("legal copy", () => {
  it("has every message key in both locales", () => {
    expect(keyPaths(es).sort()).toEqual(keyPaths(en).sort());
  });

  it.each([
    ["en", en],
    ["es", es],
  ])("has %s copy for exactly the manifest's sections, each with a heading and text", (_locale, messages) => {
    for (const doc of DOCS) {
      const sections: Record<string, { heading?: unknown; body?: unknown; list?: unknown }> = messages.legal[doc].sections;
      expect(Object.keys(sections)).toEqual([...LEGAL_SECTIONS[doc]]);
      for (const section of Object.values(sections)) {
        expect(typeof section.heading).toBe("string");
        expect(Array.isArray(section.body)).toBe(true);
        const items = [...(section.body as unknown[]), ...((section.list as unknown[] | undefined) ?? [])];
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((item) => typeof item === "string")).toBe(true);
      }
    }
  });

  it("links the support email in the same places in both locales", () => {
    const emailTags = (messages: typeof en) =>
      keyPaths(messages.legal).filter((path) => {
        const value = path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages.legal);
        return String(value).includes("<email>{address}</email>");
      });
    expect(emailTags(es)).toEqual(emailTags(en));
    expect(emailTags(en).length).toBeGreaterThan(0);
  });

  it("promises no returns window: the policy is not decided yet", () => {
    for (const messages of [en, es]) {
      expect(JSON.stringify(messages.legal.terms.sections.returns)).not.toMatch(/\d/);
      expect(JSON.stringify(messages.legal)).not.toMatch(/\b30\b/);
    }
  });
});

describe("legal facts", () => {
  it("mirrors the support address the order emails use", () => {
    expect(SUPPORT_EMAIL).toBe(EMAIL_SUPPORT_ADDRESS);
  });

  it("formats the last-updated date per locale without shifting the day", () => {
    expect(formatLastUpdated("en", "2026-10-20")).toBe("October 20, 2026");
    expect(formatLastUpdated("es", "2026-10-20")).toBe("20 de octubre de 2026");
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("counts consecutive indexed entries", () => {
    const keys = new Set(["s.body.0", "s.body.1", "s.body.3"]);
    expect(countItems((key) => keys.has(key), "s.body")).toBe(2);
    expect(countItems((key) => keys.has(key), "s.list")).toBe(0);
  });

  it("lists both pages in the sitemap in every locale", () => {
    const urls = buildSitemap([], "https://example.com", new Date(0), NONE_LIVE).map((e) => e.url);
    for (const locale of ["en", "es"]) {
      expect(urls).toContain(`https://example.com/${locale}/terms`);
      expect(urls).toContain(`https://example.com/${locale}/privacy`);
    }
  });
});
