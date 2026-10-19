/**
 * One-shot and idempotent catalog data jobs: the dev seed, the unified-catalog
 * migration (ADR 0015/0016) and bulk apparel repricing.
 */
import { mutation, internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { getVariant, listSkus } from "./inventory";
import { SHIRT_VARIANTS } from "../../src/data/caps";
import catalogShots from "../../src/data/catalogShots.json";
import { SEED_PRODUCT, SEED_VARIANTS } from "./data";
import { distributeStock, renamedLifestyleShot as renamed, teeFieldsPatch, TEE_SIZES, variantCategory } from "./model";
import type { Id } from "../_generated/dataModel";
import { deleteStorageQuietly, MAX_CATALOG_VARIANTS } from "./shared";
import { isStorageIdReferenced, legacyVariantStorageIds } from "./images/references";

/** Rows of each table one `seedAll` wipes; past it the seed refuses (and writes nothing) rather than wipe part of the catalog. */
export const SEED_WIPE_LIMIT = 2000;

async function takeAllForWipe<T>(rows: Promise<T[]>, table: string): Promise<T[]> {
  const out = await rows;
  if (out.length > SEED_WIPE_LIMIT) {
    throw new ConvexError(`seedAll: more than ${SEED_WIPE_LIMIT} ${table} rows; clear the deployment instead.`);
  }
  return out;
}

/**
 * Dev/fresh-deployment seed: wipes the catalog (products, variants, SKUs, product images and
 * the catalog audit log) and inserts catalog/data.ts. Files are deleted only once nothing
 * references them (same check as `deleteStorageFile`).
 */
export const seedAll = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), count: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const limit = SEED_WIPE_LIMIT + 1;
    const products = await takeAllForWipe(ctx.db.query("products").take(limit), "products");
    const variants = await takeAllForWipe(ctx.db.query("variants").take(limit), "variants");
    const skus = await takeAllForWipe(ctx.db.query("skus").take(limit), "skus");
    const images = await takeAllForWipe(ctx.db.query("productImages").take(limit), "productImages");
    const events = await takeAllForWipe(ctx.db.query("catalog_events").take(limit), "catalog_events");

    const files = new Set<Id<"_storage">>();
    for (const variant of variants) if (variant.storageId) files.add(variant.storageId);
    for (const image of images) files.add(image.storageId);

    for (const row of products) await ctx.db.delete("products", row._id);
    for (const row of variants) await ctx.db.delete("variants", row._id);
    for (const row of skus) await ctx.db.delete("skus", row._id);
    for (const row of images) await ctx.db.delete("productImages", row._id);
    for (const row of events) await ctx.db.delete("catalog_events", row._id);

    const legacy = await legacyVariantStorageIds(ctx);
    for (const storageId of files) {
      if (!(await isStorageIdReferenced(ctx, storageId, legacy))) await deleteStorageQuietly(ctx, storageId);
    }

    await ctx.db.insert("products", SEED_PRODUCT);

    for (const v of SEED_VARIANTS) {
      await ctx.db.insert("variants", v);
    }

    return { success: true, count: SEED_VARIANTS.length };
  },
});

type CatalogShotsManifest = {
  caps: Record<string, { catalog: string }>;
  tees: Record<string, { colorways: Record<string, string> }>;
};
const SHOTS = catalogShots as CatalogShotsManifest;

/**
 * Idempotent catalog migration (ADR 0015/0016). Run with:
 *   npx convex run catalogMigrations:migrateUnifiedCatalog
 * - Caps: set `catalogShot` from src/data/catalogShots.json.
 * - Tees: fill colorways, sizes, artwork and fit/fabric copy from src/data/caps.ts where the
 *   variant has none (never overwriting existing values), rewrite Lifestyle Shot paths that
 *   still use the old file names, and seed SKUs from the current stock (only when the tee
 *   has no SKUs yet).
 */
export const migrateUnifiedCatalog = internalMutation({
  args: {},
  returns: v.object({ capsUpdated: v.number(), teesUpdated: v.number(), teesInserted: v.number(), skusSeeded: v.number() }),
  handler: async (ctx) => {
    const report = { capsUpdated: 0, teesUpdated: 0, teesInserted: 0, skusSeeded: 0 };

    for (const [variantId, shot] of Object.entries(SHOTS.caps)) {
      const variant = await getVariant(ctx, variantId);
      if (variant && variant.catalogShot !== shot.catalog) {
        await ctx.db.patch("variants", variant._id, { catalogShot: shot.catalog });
        report.capsUpdated++;
      }
    }

    for (const tee of SHIRT_VARIANTS) {
      const shots = SHOTS.tees[tee.id]?.colorways ?? {};
      const colorways = (tee.colorways ?? []).map((c) => ({
        id: c.id,
        nameEn: c.nameEn,
        nameEs: c.nameEs,
        hex: c.hex,
        borderHex: c.borderHex,
        lifestyleImage: renamed(c.modelImage),
        catalogShot: shots[c.id] ?? renamed(c.modelImage),
      }));
      const defaultColorway = tee.defaultColorway ?? colorways[0]?.id;
      const teeFields = {
        silhouette: "tee",
        category: "apparel",
        image: renamed(tee.image),
        images: tee.images?.map(renamed),
        catalogShot: defaultColorway ? shots[defaultColorway] : undefined,
        graphicImage: tee.graphicImage,
        printPosition: tee.printPosition,
        fabricEn: tee.fabricEn,
        fabricEs: tee.fabricEs,
        fitEn: tee.fitEn,
        fitEs: tee.fitEs,
        defaultColorway,
        colorways,
        sizes: [...TEE_SIZES],
      };

      let variant = await getVariant(ctx, tee.id);
      if (variant) {
        const patch = teeFieldsPatch(variant, teeFields);
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch("variants", variant._id, patch);
          report.teesUpdated++;
        }
      } else {
        await ctx.db.insert("variants", {
          variantId: tee.id,
          nameEn: tee.nameEn,
          nameEs: tee.nameEs,
          primaryHex: tee.primaryHex,
          secondaryHex: tee.secondaryHex,
          stock: tee.stock,
          priceUsd: tee.priceUsd,
          isFeatured: tee.isFeatured ?? false,
          isAvailable: true,
          taxCode: "txcd_30011000",
          ...teeFields,
        });
        report.teesInserted++;
      }
      variant = (await getVariant(ctx, tee.id))!;

      const existing = await listSkus(ctx, variant.variantId);
      if (existing.length === 0 && defaultColorway) {
        const cells = distributeStock(variant.stock, colorways.map((c) => c.id), defaultColorway);
        for (const cell of cells) {
          await ctx.db.insert("skus", { variantId: variant.variantId, ...cell });
        }
        report.skusSeeded += cells.length;
      }
    }

    return report;
  },
});

/**
 * One-shot repricing of every Heavyweight Tee (e.g. the $160 → $80 change). Existing orders
 * keep the price they were sold at. Run with:
 *   npx convex run catalogMigrations:setApparelPriceUsd '{"priceUsd": 80}'
 */
export const setApparelPriceUsd = internalMutation({
  args: { priceUsd: v.number() },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.priceUsd) || args.priceUsd <= 0) {
      throw new ConvexError("priceUsd must be a positive number");
    }
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    let updated = 0;
    for (const variant of variants) {
      const isTee = variant.category === "apparel" || variant.silhouette === "tee";
      if (isTee && variant.priceUsd !== args.priceUsd) {
        await ctx.db.patch("variants", variant._id, { priceUsd: args.priceUsd });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * Fill the storefront badge text on featured products that have none, from the copy that
 * was hardcoded in `toCapVariant`. Idempotent: rows with a badge (even a cleared, empty one) or
 * not featured are left alone.
 */
export const backfillBadges = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    let updated = 0;
    for (const variant of variants) {
      // "" is a badge the Administrator cleared on purpose; only a never-set badge is filled.
      if (!variant.isFeatured || variant.badgeTextEn !== undefined || variant.badgeTextEs !== undefined) continue;
      const isTee = variantCategory(variant) === "apparel";
      await ctx.db.patch("variants", variant._id, {
        badgeTextEn: isTee ? "Heavyweight Drop" : "Signature Edition",
        badgeTextEs: isTee ? "Drop Heavyweight" : "Edición Insignia",
      });
      updated++;
    }
    return { updated };
  },
});

/**
 * ADR 0022: a product is listed only when `isAvailable === true`. Rows created before that
 * rule without the flag were visible, so this marks them visible to keep the storefront as
 * it was. Idempotent; run on each deployment before the strict check ships.
 */
export const backfillAvailability = internalMutation({
  args: {},
  returns: v.object({ patched: v.number(), isDone: v.boolean() }),
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    let patched = 0;
    for (const variant of variants) {
      if (variant.isAvailable !== undefined) continue;
      await ctx.db.patch("variants", variant._id, { isAvailable: true });
      patched++;
    }
    return { patched, isDone: variants.length < MAX_CATALOG_VARIANTS };
  },
});
