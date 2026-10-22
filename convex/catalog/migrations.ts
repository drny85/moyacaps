/**
 * One-shot and idempotent catalog data jobs: the dev seed, the unified-catalog
 * migration (ADR 0015/0016), bulk apparel repricing and the field backfills.
 */
import { mutation, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { deleteCapStock, getVariant, hasSkus, listSkus, setCapStock } from "./inventory";
import { SHIRT_VARIANTS } from "../../src/data/caps";
import catalogShots from "../../src/data/catalogShots.json";
import { SEED_PRODUCT, SEED_VARIANTS } from "./data";
import { distributeStock, renamedLifestyleShot as renamed, taxCodeBackfill, teeFieldsPatch, TEE_SIZES, variantCategory } from "./model";
import type { Doc, Id } from "../_generated/dataModel";
import { deleteStorageQuietly, MAX_CATALOG_VARIANTS, MAX_PRODUCT_IMAGE_ROWS } from "./shared";
import { hiddenTeePurgeProblems, isHiddenTee, isOverdueScheduledDrop } from "./model";
import { purgeVariantRow } from "./admin";
import { isCheckoutHoldActive } from "../orders/model";
import { releaseOverdue } from "./drops";
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
 * Dev/fresh-deployment seed: wipes the catalog (products, variants, cap and SKU stock, product images and
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
    const capStock = await takeAllForWipe(ctx.db.query("variant_stock").take(limit), "variant_stock");
    const images = await takeAllForWipe(ctx.db.query("productImages").take(limit), "productImages");
    const events = await takeAllForWipe(ctx.db.query("catalog_events").take(limit), "catalog_events");

    const files = new Set<Id<"_storage">>();
    for (const variant of variants) if (variant.storageId) files.add(variant.storageId);
    for (const image of images) files.add(image.storageId);

    for (const row of products) await ctx.db.delete("products", row._id);
    for (const row of variants) await ctx.db.delete("variants", row._id);
    for (const row of skus) await ctx.db.delete("skus", row._id);
    for (const row of capStock) await ctx.db.delete("variant_stock", row._id);
    for (const row of images) await ctx.db.delete("productImages", row._id);
    for (const row of events) await ctx.db.delete("catalog_events", row._id);

    const legacy = await legacyVariantStorageIds(ctx);
    for (const storageId of files) {
      if (!(await isStorageIdReferenced(ctx, storageId, legacy))) await deleteStorageQuietly(ctx, storageId);
    }

    await ctx.db.insert("products", SEED_PRODUCT);

    for (const v of SEED_VARIANTS) {
      // Seed products are shown unless the seed says otherwise (a missing flag is hidden, ADR 0022).
      const seeded: Partial<Doc<"variants">> = v;
      // Checkout taxes by category (plan 0008 PR 4); seed caps carry neither field.
      await ctx.db.insert("variants", { ...v, ...taxCodeBackfill(v), isAvailable: seeded.isAvailable ?? true });
      if (!hasSkus(seeded)) await setCapStock(ctx, v.variantId, v.stock);
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
      // Units held before the tee has SKUs; once colorways and sizes are set, reads sum the (still empty) SKUs.
      const legacyStock = variant?.stock ?? tee.stock;
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
        const cells = distributeStock(legacyStock, colorways.map((c) => c.id), defaultColorway);
        for (const cell of cells) {
          await ctx.db.insert("skus", { variantId: variant.variantId, ...cell });
        }
        await deleteCapStock(ctx, variant.variantId);
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

/**
 * Plan 0008 PR 4: checkout refuses a product with neither a tax code nor a category. Fills a
 * missing category (from the storefront's own Caps/Tees split) and a missing tax code (from the
 * category) on every row. Rows with an unknown category are listed, not guessed. Idempotent;
 * run on each deployment before the strict checkout ships:
 *   npx convex run catalog/migrations:backfillTaxCodes
 */
export const backfillTaxCodes = internalMutation({
  args: {},
  returns: v.object({ patched: v.number(), needsReview: v.array(v.string()), isDone: v.boolean() }),
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    let patched = 0;
    const needsReview: string[] = [];
    for (const variant of variants) {
      const patch = taxCodeBackfill(variant);
      if (patch === null) {
        needsReview.push(variant.variantId);
        continue;
      }
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch("variants", variant._id, patch);
      patched++;
    }
    return { patched, needsReview, isDone: variants.length < MAX_CATALOG_VARIANTS };
  },
});

/** Actor recorded on the audit event of a release this backfill performed. */
export const RELEASE_BACKFILL_ACTOR = "system:release-overdue-drops";

/**
 * One-shot backfill for the scheduled release (catalog/drops.ts): drops scheduled before the
 * release job existed have no job, so one whose `dropDate` has already passed stays blocked
 * until an Administrator presses Release now. This releases every scheduled drop whose date is
 * past, with the same patch and audit event as the scheduled release (badge kept). Idempotent;
 * `dryRun` only reports what would be released. Run once after the deploy that ships the job:
 *   npx convex run catalog/migrations:releaseOverdueDrops '{"dryRun": true}'
 *   npx convex run catalog/migrations:releaseOverdueDrops
 */
export const releaseOverdueDrops = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({ dryRun: v.boolean(), count: v.number(), variantIds: v.array(v.string()), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true;
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    const now = Date.now();
    const variantIds = dryRun
      ? variants.filter((variant) => isOverdueScheduledDrop(variant, now)).map((variant) => variant.variantId)
      : await releaseOverdue(ctx, variants, now, RELEASE_BACKFILL_ACTOR);
    return { dryRun, count: variantIds.length, variantIds, isDone: variants.length < MAX_CATALOG_VARIANTS };
  },
});

/** Orders one hidden-Tee purge reads to find references and open Checkout Holds; past it the real run refuses. */
export const PURGE_ORDER_SCAN_LIMIT = 5000;

/** Reviews or drop alerts counted per Tee in the purge report; counts clamp at this value. */
const PURGE_COUNT_CAP = 1000;

/** Actor recorded on the `purged` audit event of each Tee this job deletes. */
export const PURGE_HIDDEN_TEES_ACTOR = "system:purge-hidden-tees";

const hiddenTeeReport = v.object({
  variantId: v.string(),
  id: v.id("variants"),
  nameEn: v.string(),
  archived: v.boolean(),
  colorways: v.array(v.string()),
  skus: v.number(),
  skuStock: v.number(),
  images: v.number(),
  hasLegacyStorageId: v.boolean(),
  reviews: v.number(),
  dropAlerts: v.number(),
  // Orders with a line for this Tee. They are never edited; their lines keep name, price and image.
  orderNumbers: v.array(v.string()),
  // Orders whose line image is one of this Tee's stored files: that photo goes blank once the file is deleted.
  ordersLosingPhoto: v.array(v.string()),
  // Open Checkout Holds on this Tee; any one blocks the real run.
  openHolds: v.array(v.string()),
});

async function reportHiddenTee(
  ctx: MutationCtx,
  variant: Doc<"variants">,
  orders: Doc<"orders">[]
): Promise<typeof hiddenTeeReport.type> {
  const skus = await listSkus(ctx, variant.variantId);
  const images = await ctx.db
    .query("productImages")
    .withIndex("by_variantId_and_role_and_order", (q) => q.eq("variantId", variant.variantId))
    .take(MAX_PRODUCT_IMAGE_ROWS);
  const fileUrls = new Set<string>();
  for (const storageId of [...images.map((row) => row.storageId), ...(variant.storageId ? [variant.storageId] : [])]) {
    const url = await ctx.storage.getUrl(storageId);
    if (url) fileUrls.add(url);
  }
  const reviews = await ctx.db
    .query("product_reviews")
    .withIndex("by_variantId_and_status_and_publishedAt", (q) => q.eq("variantId", variant.variantId))
    .take(PURGE_COUNT_CAP);
  const dropAlerts = await ctx.db
    .query("drop_alerts")
    .withIndex("by_variantId", (q) => q.eq("variantId", variant.variantId))
    .take(PURGE_COUNT_CAP);

  const lines = (order: Doc<"orders">) => order.items.filter((item) => item.variantId === variant.variantId);
  const referencing = orders.filter((order) => lines(order).length > 0);
  return {
    variantId: variant.variantId,
    id: variant._id,
    nameEn: variant.nameEn,
    archived: variant.archivedAt !== undefined,
    colorways: (variant.colorways ?? []).map((c) => c.id),
    skus: skus.length,
    skuStock: skus.reduce((sum, sku) => sum + sku.stock, 0),
    images: images.length,
    hasLegacyStorageId: variant.storageId !== undefined,
    reviews: reviews.length,
    dropAlerts: dropAlerts.length,
    orderNumbers: referencing.map((order) => order.orderNumber),
    ordersLosingPhoto: referencing
      .filter((order) => lines(order).some((item) => fileUrls.has(item.image)))
      .map((order) => order.orderNumber),
    openHolds: referencing.filter(isCheckoutHoldActive).map((order) => order.orderNumber),
  };
}

/**
 * Permanently delete hidden Heavyweight Tees (archived or never turned on) ahead of a fresh Tee
 * lineup: each Tee's row, SKUs, drop alerts and image rows go, and its stored files are deleted
 * after the 15-minute grace once nothing references them (ADR 0021). Orders and reviews are kept
 * as they are. `dryRun` lists every hidden Tee with what references it and deletes nothing. The
 * real run deletes exactly `variantIds` and refuses, writing nothing, when any id is not a hidden
 * Tee or is held by an open Checkout Hold. Run the dry run first and pass the ids it listed:
 *   npx convex run catalog/migrations:purgeHiddenTees '{"dryRun": true}'
 *   npx convex run catalog/migrations:purgeHiddenTees '{"variantIds": ["..."]}'
 */
export const purgeHiddenTees = internalMutation({
  args: { dryRun: v.optional(v.boolean()), variantIds: v.optional(v.array(v.string())) },
  returns: v.object({
    dryRun: v.boolean(),
    count: v.number(),
    tees: v.array(hiddenTeeReport),
    ordersTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true;
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    const hiddenTees = variants.filter(isHiddenTee);
    const scanned = await ctx.db.query("orders").withIndex("by_createdAt").order("desc").take(PURGE_ORDER_SCAN_LIMIT + 1);
    const ordersTruncated = scanned.length > PURGE_ORDER_SCAN_LIMIT;
    const orders = scanned.slice(0, PURGE_ORDER_SCAN_LIMIT);

    const requested = dryRun ? hiddenTees.map((tee) => tee.variantId) : [...new Set(args.variantIds ?? [])];
    const targets = hiddenTees.filter((tee) => requested.includes(tee.variantId));
    const tees: Array<typeof hiddenTeeReport.type> = [];
    for (const tee of targets) tees.push(await reportHiddenTee(ctx, tee, orders));
    if (dryRun) return { dryRun, count: tees.length, tees, ordersTruncated };

    const problems = hiddenTeePurgeProblems(
      requested,
      new Set(hiddenTees.map((tee) => tee.variantId)),
      new Map(tees.map((report) => [report.variantId, report.openHolds])),
      ordersTruncated
    );
    if (problems.length > 0) throw new ConvexError(`purgeHiddenTees refused, nothing deleted: ${problems.join("; ")}`);

    for (const tee of targets) await purgeVariantRow(ctx, tee, PURGE_HIDDEN_TEES_ACTOR);
    return { dryRun, count: tees.length, tees, ordersTruncated };
  },
});

/**
 * M7: copy each cap's legacy `variants.stock` into its own `variant_stock` row, so checkout
 * stops writing the variant document. Reads fall back to the legacy field until the row
 * exists, so this can run any time after the deploy. Idempotent: a cap that already has a
 * row (any sale or admin edit since the deploy creates one) is left alone. Run once per deployment:
 *   npx convex run catalog/migrations:backfillVariantStock
 */
export const backfillVariantStock = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), isDone: v.boolean() }),
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
    let inserted = 0;
    for (const variant of variants) {
      if (hasSkus(variant)) continue;
      const existing = await ctx.db
        .query("variant_stock")
        .withIndex("by_variantId", (q) => q.eq("variantId", variant.variantId))
        .unique();
      if (existing) continue;
      await ctx.db.insert("variant_stock", { variantId: variant.variantId, stock: variant.stock });
      inserted++;
    }
    return { inserted, isDone: variants.length < MAX_CATALOG_VARIANTS };
  },
});
