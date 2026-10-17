import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { pickNamespaces, ROUTE_SCOPED_NAMESPACES, STOREFRONT_NAMESPACES } from "../i18n/clientMessages";

describe("client message namespaces", () => {
  it.each([
    ["en", en],
    ["es", es],
  ])("classify every %s namespace exactly once", (_locale, messages) => {
    const listed = [...STOREFRONT_NAMESPACES, ...ROUTE_SCOPED_NAMESPACES];
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(messages).sort());
  });

  it("keeps the admin console's copy out of storefront pages", () => {
    expect(STOREFRONT_NAMESPACES).not.toContain("admin" as never);
  });
});

describe("pickNamespaces", () => {
  it("keeps only the requested namespaces and ignores missing ones", () => {
    expect(pickNamespaces({ nav: { a: "A" }, admin: { b: "B" } }, ["nav", "hero"])).toEqual({ nav: { a: "A" } });
  });
});
