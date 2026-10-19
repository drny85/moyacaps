/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { resolveProduct } from "./shared";

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

async function setup() {
  const t = convexTest(schema, modules);
  await t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL }).mutation(api.catalog.admin.createVariant, cap);
  return t;
}

const resolve = (t: Awaited<ReturnType<typeof setup>>) =>
  t.run(async (ctx) => {
    const variant = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", cap.variantId)).unique();
    return await resolveProduct(ctx, variant!);
  });

describe("resolveProduct", () => {
  it("keeps legacy fields when the product has no rows", async () => {
    const t = await setup();
    const out = await resolve(t);
    expect(out).toMatchObject({ image: cap.image, isAvailable: true });
    expect(out.catalogShot).toBeUndefined();
    expect(out.angles).toBeUndefined();
  });

  it("reads catalogShot from the catalog row and ignores rows whose file is gone", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const keep = await ctx.storage.store(new Blob(["a"]));
      const gone = await ctx.storage.store(new Blob(["b"]));
      await ctx.storage.delete(gone);
      const base = { variantId: cap.variantId, sha256: "x", width: 2000, height: 2500, createdAt: 1 };
      await ctx.db.insert("productImages", { ...base, role: "catalog", order: 0, storageId: keep });
      await ctx.db.insert("productImages", { ...base, role: "lifestyle", order: 0, storageId: gone });
    });
    const out = await resolve(t);
    expect(out.catalogShot).toMatch(/^https?:\/\//);
    expect(out.images).toBeUndefined();
  });
});
