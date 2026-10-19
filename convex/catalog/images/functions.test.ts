/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { PRIMARY_ADMIN_EMAIL } from "../../lib/auth";
import { MAX_IMAGES_PER_ROLE, REPLACED_FILE_GRACE_MS } from "./functions";

const modules = import.meta.glob("/convex/**/*.ts");

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
function png(w: number, h: number, colourType: number, tag = 0) {
  const ihdr = [...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, colourType, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, tag]);
}

const capBase = {
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
const teeColorway = (id: string) => ({ id, nameEn: id, nameEs: id, hex: "#000000", borderHex: "#111111", lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" });

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}
type T = ReturnType<typeof setup>["t"];

const store = (t: T, bytes: Uint8Array) => t.run((ctx) => ctx.storage.store(new Blob([bytes as BlobPart])));
const readable = (t: T, id: Id<"_storage">) => t.run(async (ctx) => (await ctx.storage.get(id)) !== null);

async function errorData(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ConvexError) return e.data;
    throw e;
  }
  throw new Error("expected the call to throw");
}

async function seed(t: T) {
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", { ...capBase });
    await ctx.db.insert("variants", {
      ...capBase,
      variantId: "tee-1",
      category: "apparel",
      silhouette: "tee",
      colorways: [teeColorway("black"), teeColorway("white")],
      sizes: ["M"],
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("attachImage", () => {
  it("attaches a valid catalog image and lists it with a url", async () => {
    const { t, admin } = setup();
    await seed(t);
    const storageId = await store(t, png(2000, 2500, 2));
    const { imageId } = await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "catalog", colorway: "black" });
    const rows = await admin.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: imageId, role: "catalog", colorway: "black", order: 0, width: 2000, height: 2500, storageId });
    expect(rows[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].url).toEqual(expect.any(String));
    const events = await t.run((ctx) => ctx.db.query("catalog_events").take(5));
    expect(events.map((e) => e.type)).toEqual(["image_added"]);
  });

  it("replaces the same slot and deletes the old file only after the grace period", async () => {
    const { t, admin } = setup();
    await seed(t);
    const first = await store(t, png(2000, 2500, 2, 1));
    const second = await store(t, png(2000, 2500, 2, 2));
    const a = await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId: first, role: "catalog", colorway: "black" });
    const b = await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId: second, role: "catalog", colorway: "black" });
    expect(b.imageId).toBe(a.imageId);
    const rows = await admin.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].storageId).toBe(second);

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10));
    expect(scheduled).toHaveLength(1);
    expect(await readable(t, first)).toBe(true);
    vi.advanceTimersByTime(REPLACED_FILE_GRACE_MS - 1000);
    await t.finishInProgressScheduledFunctions();
    expect(await readable(t, first)).toBe(true);
    vi.advanceTimersByTime(2000);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await readable(t, first)).toBe(false);
    expect(await readable(t, second)).toBe(true);
  });

  it("replaceImageId keeps the order of the replaced lifestyle image", async () => {
    const { t, admin } = setup();
    await seed(t);
    const ids: Id<"productImages">[] = [];
    for (let i = 0; i < 2; i++) {
      const storageId = await store(t, png(2000, 2500, 2, i));
      ids.push((await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "lifestyle", colorway: "black" })).imageId);
    }
    const next = await store(t, png(2000, 2500, 2, 9));
    const { imageId } = await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId: next, role: "lifestyle", colorway: "black", replaceImageId: ids[0] });
    expect(imageId).toBe(ids[0]);
    const rows = await admin.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" });
    expect(rows.map((r) => [r._id, r.order])).toEqual([[ids[0], 0], [ids[1], 1]]);
    expect(rows[0].storageId).toBe(next);
  });

  it("rejects a too-small image and deletes the upload", async () => {
    const { t, admin } = setup();
    await seed(t);
    const storageId = await store(t, png(800, 600, 2));
    expect(await errorData(admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "catalog", colorway: "black" }))).toEqual({ kind: "image_rule", code: "too_small" });
    expect(await readable(t, storageId)).toBe(false);
  });

  it("rejects an invalid slot from the mutation and deletes the upload", async () => {
    const { t, admin } = setup();
    await seed(t);
    const cases = [
      { variantId: "tee-1", role: "catalog" as const, colorway: "red" },
      { variantId: "oro-negro", role: "catalog" as const, colorway: "black" },
      { variantId: "oro-negro", role: "angle" as const },
      { variantId: "oro-negro", role: "catalog" as const, angle: "front" as const },
    ];
    for (const c of cases) {
      const storageId = await store(t, png(2000, 2500, 6));
      expect(await errorData(admin.action(api.catalog.images.attach.attachImage, { ...c, storageId }))).toEqual({ kind: "image_rule", code: "invalid_slot" });
      expect(await readable(t, storageId)).toBe(false);
    }
  });

  it("replaces an occupied angle slot and rejects a tee angle", async () => {
    const { t, admin } = setup();
    await seed(t);
    const a = await store(t, png(100, 100, 6, 1));
    const b = await store(t, png(100, 100, 6, 2));
    const r1 = await admin.action(api.catalog.images.attach.attachImage, { variantId: "oro-negro", storageId: a, role: "angle", angle: "front" });
    const r2 = await admin.action(api.catalog.images.attach.attachImage, { variantId: "oro-negro", storageId: b, role: "angle", angle: "front" });
    expect(r2.imageId).toBe(r1.imageId);
    const c = await store(t, png(100, 100, 6, 3));
    await expect(errorData(admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId: c, role: "angle", angle: "front" }))).resolves.toMatchObject({ code: "invalid_slot" });
  });

  it("rejects an archived product", async () => {
    const { t, admin } = setup();
    await seed(t);
    await t.run(async (ctx) => {
      const v = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", "tee-1")).unique();
      await ctx.db.patch("variants", v!._id, { archivedAt: 1 });
    });
    const storageId = await store(t, png(2000, 2500, 2));
    expect(await errorData(admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "catalog", colorway: "black" }))).toEqual({ kind: "archived" });
    expect(await readable(t, storageId)).toBe(false);
  });

  it("a failed attach never deletes a file that a row still uses", async () => {
    const { t, admin } = setup();
    await seed(t);
    const storageId = await store(t, png(2000, 2500, 2));
    await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "catalog", colorway: "black" });
    expect(await errorData(admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "catalog", colorway: "red" }))).toEqual({ kind: "image_rule", code: "invalid_slot" });
    expect(await readable(t, storageId)).toBe(true);
  });

  it("rejects an insert past the per-role cap", async () => {
    const { t, admin } = setup();
    await seed(t);
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      for (let i = 0; i < MAX_IMAGES_PER_ROLE; i++) {
        await ctx.db.insert("productImages", { variantId: "tee-1", role: "lifestyle", colorway: "black", order: i, storageId, sha256: "a", width: 2000, height: 2500, createdAt: 1 });
      }
    });
    const storageId = await store(t, png(2000, 2500, 2));
    expect(await errorData(admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "lifestyle", colorway: "black" }))).toEqual({ kind: "image_rule", code: "too_many" });
    expect(await readable(t, storageId)).toBe(false);
  });

  it("rejects a non-admin", async () => {
    const { t } = setup();
    await seed(t);
    const storageId = await store(t, png(2000, 2500, 2));
    const user = t.withIdentity({ subject: "user_x", email: "x@example.com" });
    const args = { variantId: "tee-1", storageId, role: "catalog" as const, colorway: "black" };
    await expect(user.action(api.catalog.images.attach.attachImage, args)).rejects.toThrow(/Forbidden/);
    await expect(t.action(api.catalog.images.attach.attachImage, args)).rejects.toThrow(/Unauthorized/);
    expect(await readable(t, storageId)).toBe(true);
  });
});

describe("removeImage and reorderImages", () => {
  async function addLifestyle(t: T, admin: ReturnType<typeof setup>["admin"], n: number) {
    const ids: Id<"productImages">[] = [];
    for (let i = 0; i < n; i++) {
      const storageId = await store(t, png(2000, 2500, 2, i));
      ids.push((await admin.action(api.catalog.images.attach.attachImage, { variantId: "tee-1", storageId, role: "lifestyle", colorway: "black" })).imageId);
    }
    return ids;
  }

  it("reorder persists the new order and logs it", async () => {
    const { t, admin } = setup();
    await seed(t);
    const [a, b, c] = await addLifestyle(t, admin, 3);
    await admin.mutation(api.catalog.images.functions.reorderImages, { variantId: "tee-1", role: "lifestyle", colorway: "black", orderedIds: [c, a, b] });
    const rows = await admin.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" });
    expect(rows.map((r) => [r._id, r.order])).toEqual([[c, 0], [a, 1], [b, 2]]);
    const events = await t.run((ctx) => ctx.db.query("catalog_events").order("desc").take(1));
    expect(events[0].type).toBe("images_reordered");
  });

  it("reorder rejects a set that is not exactly the slot's images", async () => {
    const { t, admin } = setup();
    await seed(t);
    const [a, b] = await addLifestyle(t, admin, 2);
    const args = { variantId: "tee-1", role: "lifestyle" as const, colorway: "black" };
    const bad = { kind: "image_rule", code: "invalid_order" };
    expect(await errorData(admin.mutation(api.catalog.images.functions.reorderImages, { ...args, orderedIds: [a] }))).toEqual(bad);
    expect(await errorData(admin.mutation(api.catalog.images.functions.reorderImages, { ...args, orderedIds: [a, a] }))).toEqual(bad);
    expect(await errorData(admin.mutation(api.catalog.images.functions.reorderImages, { ...args, colorway: "white", orderedIds: [a, b] }))).toEqual(bad);
  });

  it("remove deletes the row and the file after the grace period", async () => {
    const { t, admin } = setup();
    await seed(t);
    const [a] = await addLifestyle(t, admin, 1);
    const row = await t.run((ctx) => ctx.db.get("productImages", a));
    await admin.mutation(api.catalog.images.functions.removeImage, { imageId: a });
    expect(await admin.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" })).toEqual([]);
    expect(await readable(t, row!.storageId)).toBe(true);
    vi.advanceTimersByTime(REPLACED_FILE_GRACE_MS + 1000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await readable(t, row!.storageId)).toBe(false);
    const events = await t.run((ctx) => ctx.db.query("catalog_events").order("desc").take(1));
    expect(events[0].type).toBe("image_removed");
  });

  it("remove of a missing image is a structured error", async () => {
    const { t, admin } = setup();
    await seed(t);
    const [a] = await addLifestyle(t, admin, 1);
    await admin.mutation(api.catalog.images.functions.removeImage, { imageId: a });
    expect(await errorData(admin.mutation(api.catalog.images.functions.removeImage, { imageId: a }))).toEqual({ kind: "image_rule", code: "not_found" });
  });

  it("deleteStorageFile skips a file a variant's legacy storageId uses", async () => {
    const { t } = setup();
    await seed(t);
    const kept = await store(t, png(10, 10, 2, 1));
    const orphan = await store(t, png(10, 10, 2, 2));
    await t.run(async (ctx) => {
      const v = await ctx.db.query("variants").withIndex("by_variantId", (q) => q.eq("variantId", "oro-negro")).unique();
      await ctx.db.patch("variants", v!._id, { storageId: kept });
    });
    await t.mutation(internal.catalog.images.functions.deleteStorageFile, { storageId: kept });
    await t.mutation(internal.catalog.images.functions.deleteStorageFile, { storageId: orphan });
    expect(await readable(t, kept)).toBe(true);
    expect(await readable(t, orphan)).toBe(false);
  });

  it("non-admin cannot remove, reorder or list", async () => {
    const { t, admin } = setup();
    await seed(t);
    const [a] = await addLifestyle(t, admin, 1);
    const user = t.withIdentity({ subject: "user_x", email: "x@example.com" });
    await expect(user.mutation(api.catalog.images.functions.removeImage, { imageId: a })).rejects.toThrow();
    await expect(user.mutation(api.catalog.images.functions.reorderImages, { variantId: "tee-1", role: "lifestyle", colorway: "black", orderedIds: [a] })).rejects.toThrow();
    await expect(user.query(api.catalog.images.functions.listProductImages, { variantId: "tee-1" })).rejects.toThrow();
  });
});
