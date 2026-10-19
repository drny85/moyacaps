/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { ORPHAN_AGE_MS } from "./cleanup";

const modules = import.meta.glob("/convex/**/*.ts");
const HOUR = 60 * 60 * 1000;

const variantBase = {
  variantId: "oro-negro",
  nameEn: "Gold / Black",
  nameEs: "Oro / Negro",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  image: "/caps/oro-negro.png",
  stock: 1,
  priceUsd: 45,
  isFeatured: false,
};

async function store(t: ReturnType<typeof convexTest>, label: string) {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([label])));
}
const exists = (t: ReturnType<typeof convexTest>, id: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);
const createdAt = (t: ReturnType<typeof convexTest>, id: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get("_storage", id))!._creationTime);

describe("sweepOrphans", () => {
  it("deletes only old unreferenced files", async () => {
    const t = convexTest(schema, modules);
    const imageRef = await store(t, "image-ref");
    const legacyRef = await store(t, "legacy-ref");
    const orphan = await store(t, "orphan");
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...variantBase, storageId: legacyRef });
      await ctx.db.insert("productImages", {
        variantId: "oro-negro", role: "catalog", order: 0, storageId: imageRef,
        sha256: "a".repeat(64), width: 1, height: 1, createdAt: 0,
      });
    });
    const now = (await createdAt(t, orphan)) + ORPHAN_AGE_MS + HOUR;

    const result = await t.mutation(internal.catalog.images.cleanup.sweepOrphans, { cursor: null, now });

    expect(result).toEqual({ scanned: 3, deleted: 1 });
    expect(await exists(t, orphan)).toBe(false);
    expect(await exists(t, imageRef)).toBe(true);
    expect(await exists(t, legacyRef)).toBe(true);
  });

  it("keeps a fresh unreferenced file", async () => {
    const t = convexTest(schema, modules);
    const fresh = await store(t, "fresh");
    const now = (await createdAt(t, fresh)) + HOUR;
    const result = await t.mutation(internal.catalog.images.cleanup.sweepOrphans, { now });
    expect(result).toEqual({ scanned: 1, deleted: 0 });
    expect(await exists(t, fresh)).toBe(true);
  });

  it("continues through pages via the scheduler", async () => {
    const t = convexTest(schema, modules);
    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 201; i++) ids.push(await store(t, `f${i}`));
    const now = (await createdAt(t, ids[0])) + ORPHAN_AGE_MS + HOUR;

    const first = await t.mutation(internal.catalog.images.cleanup.sweepOrphans, { now });
    expect(first).toEqual({ scanned: 200, deleted: 200 });

    const scheduled = await t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].name).toContain("sweepOrphans");
    const [next] = scheduled[0].args as [{ cursor: string; now: number }];
    expect(next.now).toBe(now);

    const second = await t.mutation(internal.catalog.images.cleanup.sweepOrphans, next);
    expect(second).toEqual({ scanned: 1, deleted: 1 });
    expect(await t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
  });
});
