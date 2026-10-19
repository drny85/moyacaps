/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { MAX_CATALOG_VARIANTS } from "../shared";

const modules = import.meta.glob("/convex/**/*.ts");

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
function png(w: number, h: number, tag = 0) {
  const ihdr = [...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, 6, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, tag]);
}

const capBase = {
  nameEn: "Gold / Black",
  nameEs: "Oro / Negro",
  category: "headwear",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  image: "/caps/x.png",
  stock: 1,
  priceUsd: 45,
  isFeatured: false,
};
const teeColorway = (id: string) => ({ id, nameEn: id, nameEs: id, hex: "#000", borderHex: "#111", lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" });

const sha = (c: string) => c.repeat(64);

async function setup() {
  const t = convexTest(schema, modules);
  const file = (label: string) => t.run(async (ctx) => ctx.storage.store(new Blob([label])));
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", { ...capBase, variantId: "cap-a" });
    await ctx.db.insert("variants", {
      ...capBase, variantId: "tee-x", category: "apparel", colorways: [teeColorway("black")], sizes: ["M"],
    });
  });
  return { t, file };
}
const rows = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run((ctx) => ctx.db.query("productImages").collect());
const base = { width: 800, height: 1000 };

describe("importImage", () => {
  it("inserts a row without applying the upload rules", async () => {
    const { t, file } = await setup();
    const storageId = await file("a");
    const r = await t.mutation(internal.catalog.images.migration.importImage, {
      variantId: "cap-a", role: "catalog", storageId, sha256: sha("a"), ...base,
    });
    expect(r).toEqual({ skipped: false });
    expect(await rows(t)).toMatchObject([{ variantId: "cap-a", role: "catalog", sha256: sha("a"), width: 800, order: 0 }]);
  });

  it("is a no-op when the same sha256 is already in that slot", async () => {
    const { t, file } = await setup();
    const storageId = await file("a");
    const args = { variantId: "cap-a", role: "angle" as const, angle: "front" as const, storageId, sha256: sha("a"), ...base };
    await t.mutation(internal.catalog.images.migration.importImage, args);
    const again = await t.mutation(internal.catalog.images.migration.importImage, args);
    expect(again).toEqual({ skipped: true, reason: "duplicate" });
    expect(await rows(t)).toHaveLength(1);
  });

  it("never overwrites a different image already in a catalog or angle slot", async () => {
    const { t, file } = await setup();
    const adminFile = await file("admin");
    const legacyFile = await file("legacy");
    await t.mutation(internal.catalog.images.migration.importImage, {
      variantId: "cap-a", role: "catalog", storageId: adminFile, sha256: sha("b"), ...base,
    });
    const r = await t.mutation(internal.catalog.images.migration.importImage, {
      variantId: "cap-a", role: "catalog", storageId: legacyFile, sha256: sha("a"), ...base,
    });
    expect(r).toEqual({ skipped: true, reason: "slot_taken" });
    const all = await rows(t);
    expect(all).toHaveLength(1);
    expect(all[0].storageId).toBe(adminFile);
  });

  it("appends different lifestyle images and skips the same one", async () => {
    const { t, file } = await setup();
    const one = { variantId: "tee-x", role: "lifestyle" as const, colorway: "black", ...base };
    await t.mutation(internal.catalog.images.migration.importImage, { ...one, storageId: await file("1"), sha256: sha("1") });
    await t.mutation(internal.catalog.images.migration.importImage, { ...one, storageId: await file("2"), sha256: sha("2") });
    const dup = await t.mutation(internal.catalog.images.migration.importImage, { ...one, storageId: await file("1"), sha256: sha("1") });
    expect(dup).toEqual({ skipped: true, reason: "duplicate" });
    expect((await rows(t)).map((r) => r.order).sort()).toEqual([0, 1]);
  });

  it("rejects a slot that does not fit the product", async () => {
    const { t, file } = await setup();
    await expect(
      t.mutation(internal.catalog.images.migration.importImage, {
        variantId: "tee-x", role: "angle", angle: "front", storageId: await file("a"), sha256: sha("a"), ...base,
      }),
    ).rejects.toThrow();
  });
});

describe("slotStatus / findStorageBySha256", () => {
  it("reports free, duplicate and taken, and finds a stored file by hash", async () => {
    const { t, file } = await setup();
    const storageId = await file("a");
    const slot = { variantId: "cap-a", role: "catalog" as const };
    expect(await t.query(internal.catalog.images.migration.slotStatus, { ...slot, sha256: sha("a") })).toBe("free");
    await t.mutation(internal.catalog.images.migration.importImage, { ...slot, storageId, sha256: sha("a"), ...base });
    expect(await t.query(internal.catalog.images.migration.slotStatus, { ...slot, sha256: sha("a") })).toBe("duplicate");
    expect(await t.query(internal.catalog.images.migration.slotStatus, { ...slot, sha256: sha("b") })).toBe("taken");
    expect(await t.query(internal.catalog.images.migration.findStorageBySha256, { sha256: sha("a") })).toBe(storageId);
    expect(await t.query(internal.catalog.images.migration.findStorageBySha256, { sha256: sha("z") })).toBeNull();
  });
});

describe("importLegacyVariantImages", () => {
  it("imports an archived product's legacy file and keeps going", async () => {
    const { t } = await setup();
    const file: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob([png(640, 800, 9)])));
    const file2: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob([png(640, 800, 8)])));
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...capBase, variantId: "cap-old", storageId: file, archivedAt: 1 });
      await ctx.db.insert("variants", { ...capBase, variantId: "cap-new", storageId: file2 });
    });
    const r = await t.action(internal.catalog.images.migration.importLegacyVariantImages, {});
    expect(r).toEqual({ imported: 2, skipped: 0, failed: 0 });
    expect((await rows(t)).map((x) => x.variantId).sort()).toEqual(["cap-new", "cap-old"]);
  });

  it("refuses to run when the catalog exceeds the scan cap", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_CATALOG_VARIANTS; i++) await ctx.db.insert("variants", { ...capBase, variantId: `v${i}` });
    });
    await expect(t.query(internal.catalog.images.migration.legacyImportCandidates, {})).rejects.toThrow(/too large/);
  });

  it("turns variants.storageId into catalog rows, reusing the file, and is idempotent", async () => {
    const { t } = await setup();
    const legacy: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob([png(640, 800, 1)])));
    const covered: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob([png(640, 800, 2)])));
    const other: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob([png(640, 800, 3)])));
    const junk: Id<"_storage"> = await t.run(async (ctx) => ctx.storage.store(new Blob(["not an image"])));
    await t.run(async (ctx) => {
      const a = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", "cap-a")).unique();
      await ctx.db.patch("variants", a!._id, { storageId: legacy });
      await ctx.db.insert("variants", { ...capBase, variantId: "cap-covered", storageId: covered });
      await ctx.db.insert("productImages", {
        variantId: "cap-covered", role: "catalog", order: 0, storageId: other, sha256: sha("c"), width: 1, height: 1, createdAt: 0,
      });
      await ctx.db.insert("variants", { ...capBase, variantId: "cap-junk", storageId: junk });
    });

    const first = await t.action(internal.catalog.images.migration.importLegacyVariantImages, {});
    expect(first).toEqual({ imported: 1, skipped: 2, failed: 0 });
    const imported = (await rows(t)).find((r) => r.variantId === "cap-a")!;
    expect(imported).toMatchObject({ role: "catalog", storageId: legacy, width: 640, height: 800 });
    expect(imported.colorway).toBeUndefined();
    expect(imported.sha256).toMatch(/^[0-9a-f]{64}$/);

    const second = await t.action(internal.catalog.images.migration.importLegacyVariantImages, {});
    expect(second).toEqual({ imported: 0, skipped: 3, failed: 0 });
    expect(await rows(t)).toHaveLength(2);
  });
});

describe("legacyImageFields", () => {
  it("returns raw legacy image fields for every variant, archived included, never overlaid with rows", async () => {
    const { t, file } = await setup();
    const legacy = await file("legacy");
    const imported = await file("imported");
    await t.run(async (ctx) => {
      const a = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", "cap-a")).unique();
      await ctx.db.patch("variants", a!._id, { images: ["/l/1.jpg", "/l/2.jpg"], catalogShot: "/c/a.webp", storageId: legacy });
      await ctx.db.insert("variants", { ...capBase, variantId: "cap-archived", isAvailable: false, archivedAt: 1, images: ["/l/z.jpg"] });
      await ctx.db.insert("productImages", {
        variantId: "cap-a", role: "lifestyle", order: 0, storageId: imported, sha256: sha("i"), width: 1, height: 1, createdAt: 0,
      });
    });
    const out = await t.query(internal.catalog.images.migration.legacyImageFields, {});
    expect(out.map((v) => v.variantId).sort()).toEqual(["cap-a", "cap-archived", "tee-x"]);
    expect(out.find((v) => v.variantId === "cap-a")).toEqual({
      variantId: "cap-a",
      category: "headwear",
      image: "/caps/x.png",
      images: ["/l/1.jpg", "/l/2.jpg"],
      catalogShot: "/c/a.webp",
      storageId: legacy,
    });
    expect(out.find((v) => v.variantId === "tee-x")?.colorways).toEqual([{ id: "black", lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" }]);
  });

  it("refuses a catalog past the scan cap", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_CATALOG_VARIANTS; i++) await ctx.db.insert("variants", { ...capBase, variantId: `v${i}` });
    });
    await expect(t.query(internal.catalog.images.migration.legacyImageFields, {})).rejects.toThrow(/too large/);
  });
});
