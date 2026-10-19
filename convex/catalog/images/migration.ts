/**
 * One-off import of existing product images into `productImages` (ADR 0021, decision 7),
 * driven by scripts/migrate-product-images.ts. Everything here is idempotent and never
 * overwrites an image an Administrator uploaded. Grandfathered assets are not held to the
 * upload rules (1600px short side, alpha): only their real dimensions are recorded.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import { recordCatalogEvent } from "../audit";
import { MAX_CATALOG_VARIANTS, requireVariant } from "../shared";
import { MAX_IMAGES_PER_ROLE } from "./functions";
import { readImageHeader } from "./header";
import { isValidSlot, type ImageSlot } from "./slots";
import { capAngleValidator, imageRoleValidator, imageRuleError } from "./validators";

const MIGRATION_ACTOR = "migration";

export type SlotStatus = "free" | "duplicate" | "taken";

/** `rows` are the product's images in `slot.role`. Lifestyle is a list; catalog and angle are single-slot. */
export function slotStatusFor(rows: Doc<"productImages">[], slot: ImageSlot, sha256: string): SlotStatus {
  const inSlot = rows.filter((r) => r.colorway === slot.colorway && r.angle === slot.angle);
  if (inSlot.some((r) => r.sha256 === sha256)) return "duplicate";
  if (slot.role !== "lifestyle" && inSlot.length > 0) return "taken";
  return "free";
}

async function roleRows(ctx: QueryCtx, variantId: string, role: Doc<"productImages">["role"]) {
  return await ctx.db
    .query("productImages")
    .withIndex("by_variantId_and_role_and_order", (q) => q.eq("variantId", variantId).eq("role", role))
    .take(MAX_IMAGES_PER_ROLE);
}

const slotArgs = {
  variantId: v.string(),
  role: imageRoleValidator,
  colorway: v.optional(v.string()),
  angle: v.optional(capAngleValidator),
  sha256: v.string(),
};

export const slotStatus = internalQuery({
  args: slotArgs,
  returns: v.union(v.literal("free"), v.literal("duplicate"), v.literal("taken")),
  handler: async (ctx, args) => {
    const rows = await roleRows(ctx, args.variantId, args.role);
    return slotStatusFor(rows, { role: args.role, colorway: args.colorway, angle: args.angle }, args.sha256);
  },
});

/** Storage file already holding these bytes, so the script reuses it instead of uploading again. */
export const findStorageBySha256 = internalQuery({
  args: { sha256: v.string() },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("productImages").withIndex("by_sha256", (q) => q.eq("sha256", args.sha256)).first();
    return row?.storageId ?? null;
  },
});

export const importImage = internalMutation({
  args: { ...slotArgs, storageId: v.id("_storage"), width: v.number(), height: v.number() },
  returns: v.union(
    v.object({ skipped: v.literal(false) }),
    v.object({ skipped: v.literal(true), reason: v.union(v.literal("duplicate"), v.literal("slot_taken")) }),
  ),
  handler: async (ctx, args) => {
    const variant = await requireVariant(ctx, args.variantId);
    const slot: ImageSlot = { role: args.role, colorway: args.colorway, angle: args.angle };
    if (!isValidSlot(slot, (variant.colorways ?? []).map((c) => c.id))) throw imageRuleError("invalid_slot");

    const rows = await roleRows(ctx, variant.variantId, args.role);
    const status = slotStatusFor(rows, slot, args.sha256);
    if (status === "duplicate") return { skipped: true as const, reason: "duplicate" as const };
    if (status === "taken") return { skipped: true as const, reason: "slot_taken" as const };
    if (rows.length >= MAX_IMAGES_PER_ROLE) throw imageRuleError("too_many");

    const order = rows.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    await ctx.db.insert("productImages", {
      variantId: variant.variantId,
      colorway: args.colorway,
      role: args.role,
      angle: args.angle,
      order,
      storageId: args.storageId,
      sha256: args.sha256,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    });
    await recordCatalogEvent(ctx, {
      variantId: variant.variantId,
      type: "image_added",
      actor: MIGRATION_ACTOR,
      changes: [{ field: "image", from: null, to: { role: args.role, colorway: args.colorway, angle: args.angle, sha256: args.sha256 } }],
    });
    return { skipped: false as const };
  },
});

/** Variants whose legacy upload has no catalog row yet; `covered` counts the ones that do. */
export const legacyImportCandidates = internalQuery({
  args: {},
  returns: v.object({
    candidates: v.array(v.object({ variantId: v.string(), storageId: v.id("_storage") })),
    covered: v.number(),
  }),
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS + 1);
    if (variants.length > MAX_CATALOG_VARIANTS) {
      throw new ConvexError("The catalog is too large to migrate legacy images in one pass.");
    }
    const candidates: { variantId: string; storageId: Id<"_storage"> }[] = [];
    let covered = 0;
    for (const variant of variants) {
      if (!variant.storageId) continue;
      const catalogRows = await roleRows(ctx, variant.variantId, "catalog");
      if (catalogRows.some((r) => r.colorway === undefined)) covered += 1;
      else candidates.push({ variantId: variant.variantId, storageId: variant.storageId });
    }
    return { candidates, covered };
  },
});

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Legacy `variants.storageId` uploads become catalog rows pointing at the same file (no re-upload),
 * so dropping that field later cannot make the orphan sweep delete them.
 */
export const importLegacyVariantImages = internalAction({
  args: {},
  returns: v.object({ imported: v.number(), skipped: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ imported: number; skipped: number; failed: number }> => {
    const { candidates, covered } = await ctx.runQuery(internal.catalog.images.migration.legacyImportCandidates, {});
    let imported = 0;
    let skipped = covered;
    let failed = 0;
    for (const { variantId, storageId } of candidates) {
      const blob = await ctx.storage.get(storageId);
      const buffer = blob ? await blob.arrayBuffer() : null;
      const header = buffer ? readImageHeader(new Uint8Array(buffer)) : null;
      if (!buffer || !header) {
        console.warn(`[image-migration] legacy file for "${variantId}" is missing or not a readable image; skipped.`);
        skipped += 1;
        continue;
      }
      try {
        const result = await ctx.runMutation(internal.catalog.images.migration.importImage, {
          variantId,
          role: "catalog",
          storageId,
          sha256: await sha256Hex(buffer),
          width: header.width,
          height: header.height,
        });
        if (result.skipped) skipped += 1;
        else imported += 1;
      } catch (err) {
        console.warn(`[image-migration] legacy import for "${variantId}" failed: ${String(err)}`);
        failed += 1;
      }
    }
    return { imported, skipped, failed };
  },
});
