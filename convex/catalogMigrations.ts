/**
 * One-shot and idempotent catalog data jobs: the dev seed, the unified-catalog
 * migration (ADR 0015/0016) and bulk apparel repricing.
 */
import { mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./auth";
import { getVariant, listSkus } from "./inventory";
import { SHIRT_VARIANTS } from "../src/data/caps";
import catalogShots from "../src/data/catalogShots.json";
import { SEED_PRODUCT, SEED_VARIANTS } from "./catalogData";
import { distributeStock, LIFESTYLE_RENAMES, renamedLifestyleShot as renamed, TEE_SIZES } from "./catalogModel";
import { deleteStorageQuietly, MAX_CATALOG_VARIANTS } from "./catalogShared";

/** Dev/fresh-deployment seed: wipes the catalog and inserts catalogData.ts. */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Clear existing
    const existingProducts = await ctx.db.query("products").take(MAX_CATALOG_VARIANTS);
    for (const p of existingProducts) {
      await ctx.db.delete(p._id);
    }
    const existing = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    for (const item of existing) {
      if (item.storageId) {
        await deleteStorageQuietly(ctx, item.storageId);
      }
      await ctx.db.delete(item._id);
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
        // Fill only what is missing: re-running must never undo an Administrator's edits.
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(teeFields)) {
          if (value !== undefined && variant[key as keyof typeof variant] === undefined) patch[key] = value;
        }
        // Canonical Lifestyle Shot names: rewrite only paths that still point at the old files.
        if (LIFESTYLE_RENAMES[variant.image]) patch.image = renamed(variant.image);
        if (variant.images?.some((path) => LIFESTYLE_RENAMES[path])) patch.images = variant.images.map(renamed);
        if (variant.colorways?.some((c) => LIFESTYLE_RENAMES[c.lifestyleImage])) {
          patch.colorways = variant.colorways.map((c) => ({ ...c, lifestyleImage: renamed(c.lifestyleImage) }));
        }
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
