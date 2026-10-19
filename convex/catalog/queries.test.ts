/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");

const cap = {
  variantId: "oro-negro",
  nameEn: "Gold / Black",
  nameEs: "Oro / Negro",
  category: "headwear" as const,
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  priceUsd: 45,
  stock: 10,
  image: "/caps/oro-negro.png",
  isFeatured: false,
};

/** A visible cap, a hidden draft and an archived product. */
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", cap);
    await ctx.db.insert("variants", { ...cap, variantId: "draft", isAvailable: false, descriptionEn: "Secret copy" });
    await ctx.db.insert("variants", { ...cap, variantId: "gone", isAvailable: false, archivedAt: 1 });
  });
  return t;
}

const ids = (rows: { variantId: string }[]) => rows.map((r) => r.variantId).sort();

describe("getVariants", () => {
  it("never returns hidden products to an anonymous caller, even with includeUnavailable", async () => {
    const t = await setup();
    expect(ids(await t.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["oro-negro"]);
  });

  it("never returns hidden products to a signed-in customer", async () => {
    const t = await setup();
    const user = t.withIdentity({ subject: "user_x", email: "x@example.com" });
    expect(ids(await user.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["oro-negro"]);
  });

  it("returns hidden products to an Administrator who asks for them", async () => {
    const t = await setup();
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    expect(ids(await admin.query(api.catalog.queries.getVariants, { includeUnavailable: true }))).toEqual(["draft", "oro-negro"]);
    expect(ids(await admin.query(api.catalog.queries.getVariants, {}))).toEqual(["oro-negro"]);
  });
});

describe("getCartVariants", () => {
  it("returns only the requested ids, hidden ones included so the cart can show them unavailable", async () => {
    const t = await setup();
    await t.run((ctx) => ctx.db.insert("variants", { ...cap, variantId: "other" }));
    const rows = await t.query(api.catalog.queries.getCartVariants, { variantIds: ["draft", "oro-negro", "draft", "missing"] });
    expect(ids(rows)).toEqual(["draft", "oro-negro"]);
    expect(rows.find((r) => r.variantId === "draft")?.isAvailable).toBe(false);
  });

  it("omits archived products", async () => {
    const t = await setup();
    expect(await t.query(api.catalog.queries.getCartVariants, { variantIds: ["gone"] })).toEqual([]);
  });

  it("reads at most 50 ids", async () => {
    const t = await setup();
    const many = [...Array.from({ length: 50 }, (_, i) => `x-${i}`), "oro-negro"];
    expect(await t.query(api.catalog.queries.getCartVariants, { variantIds: many })).toEqual([]);
  });
});
