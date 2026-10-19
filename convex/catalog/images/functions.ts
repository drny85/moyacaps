/**
 * Admin product images in Convex storage (ADR 0021): replace, remove, reorder, list.
 * Upload validation lives in attach.ts; the write that follows is `insertOrReplaceImage`.
 */
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, mutation, query } from "../../_generated/server";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { requireAdmin } from "../../lib/auth";
import { actorEmail, recordCatalogEvent } from "../audit";
import { deleteStorageQuietly, requireActiveVariant } from "../shared";
import { isStorageIdReferenced } from "./references";
import { capAngleValidator, imageRoleValidator, imageRuleError } from "./validators";
import { isValidSlot, sameSlot, type ImageSlot } from "./slots";

/** A replaced or removed file outlives the 5-minute ISR window that may still serve its URL. */
export const REPLACED_FILE_GRACE_MS = 15 * 60 * 1000;

/** Upper bound for one product's images in a single role. */
export const MAX_IMAGES_PER_ROLE = 200;


async function imagesForRole(ctx: QueryCtx, variantId: string, role: Doc<"productImages">["role"]) {
  return await ctx.db
    .query("productImages")
    .withIndex("by_variantId_and_role_and_order", (q) => q.eq("variantId", variantId).eq("role", role))
    .take(MAX_IMAGES_PER_ROLE);
}

const slotOf = (row: Doc<"productImages">): ImageSlot => ({ role: row.role, colorway: row.colorway, angle: row.angle });

async function scheduleFileDelete(ctx: MutationCtx, storageId: Id<"_storage">) {
  await ctx.scheduler.runAfter(REPLACED_FILE_GRACE_MS, internal.catalog.images.functions.deleteStorageFile, { storageId });
}

/** Write half of `attachImage`. Throws `invalid_slot` when the slot does not fit the product. */
export const insertOrReplaceImage = internalMutation({
  args: {
    actor: v.string(),
    variantId: v.string(),
    storageId: v.id("_storage"),
    role: imageRoleValidator,
    colorway: v.optional(v.string()),
    angle: v.optional(capAngleValidator),
    replaceImageId: v.optional(v.id("productImages")),
    sha256: v.string(),
    width: v.number(),
    height: v.number(),
  },
  returns: v.object({ imageId: v.id("productImages") }),
  handler: async (ctx, args) => {
    const variant = await requireActiveVariant(ctx, args.variantId);
    const slot: ImageSlot = { role: args.role, colorway: args.colorway, angle: args.angle };
    if (!isValidSlot(slot, (variant.colorways ?? []).map((c) => c.id))) throw imageRuleError("invalid_slot");

    const rows = await imagesForRole(ctx, variant.variantId, args.role);
    let target: Doc<"productImages"> | undefined;
    if (args.replaceImageId) {
      target = rows.find((r) => r._id === args.replaceImageId);
      if (!target || !sameSlot(slotOf(target), slot)) throw imageRuleError("invalid_slot");
    } else if (args.role !== "lifestyle") {
      target = rows.find((r) => sameSlot(slotOf(r), slot));
    }

    const file = { storageId: args.storageId, sha256: args.sha256, width: args.width, height: args.height };
    const detail = { role: args.role, colorway: args.colorway, angle: args.angle };

    if (target) {
      await ctx.db.patch("productImages", target._id, file);
      if (target.storageId !== args.storageId) await scheduleFileDelete(ctx, target.storageId);
      await recordCatalogEvent(ctx, {
        variantId: variant.variantId,
        type: "image_replaced",
        actor: args.actor,
        changes: [{ field: "image", from: { ...detail, sha256: target.sha256 }, to: { ...detail, sha256: args.sha256 } }],
      });
      return { imageId: target._id };
    }

    if (rows.length >= MAX_IMAGES_PER_ROLE) throw imageRuleError("too_many");
    const order = rows.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    const imageId = await ctx.db.insert("productImages", {
      variantId: variant.variantId,
      colorway: args.colorway,
      role: args.role,
      angle: args.angle,
      order,
      ...file,
      createdAt: Date.now(),
    });
    await recordCatalogEvent(ctx, {
      variantId: variant.variantId,
      type: "image_added",
      actor: args.actor,
      changes: [{ field: "image", from: null, to: { ...detail, sha256: args.sha256 } }],
    });
    return { imageId };
  },
});

/** Delete every image row of a product and schedule its files (used when the product is purged). */
export async function deleteAllProductImages(ctx: MutationCtx, variantId: string) {
  for (const role of ["catalog", "lifestyle", "angle"] as const) {
    for (const row of await imagesForRole(ctx, variantId, role)) {
      await ctx.db.delete("productImages", row._id);
      await scheduleFileDelete(ctx, row.storageId);
    }
  }
}

/** Delete the image rows of removed Apparel Colorways and schedule their files. */
export async function deleteColorwayImages(ctx: MutationCtx, variantId: string, colorways: string[]) {
  if (colorways.length === 0) return;
  for (const role of ["catalog", "lifestyle", "angle"] as const) {
    for (const row of await imagesForRole(ctx, variantId, role)) {
      if (!row.colorway || !colorways.includes(row.colorway)) continue;
      await ctx.db.delete("productImages", row._id);
      await scheduleFileDelete(ctx, row.storageId);
    }
  }
}

export const removeImage = mutation({
  args: { imageId: v.id("productImages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const image = await ctx.db.get("productImages", args.imageId);
    if (!image) throw imageRuleError("not_found");
    await requireActiveVariant(ctx, image.variantId);
    await ctx.db.delete("productImages", image._id);
    await scheduleFileDelete(ctx, image.storageId);
    await recordCatalogEvent(ctx, {
      variantId: image.variantId,
      type: "image_removed",
      actor,
      changes: [{ field: "image", from: { role: image.role, colorway: image.colorway, angle: image.angle, sha256: image.sha256 }, to: null }],
    });
    return null;
  },
});

/** `orderedIds` must be exactly the images of that (product, role, colorway); they get order 0..n-1. */
export const reorderImages = mutation({
  args: {
    variantId: v.string(),
    role: imageRoleValidator,
    colorway: v.optional(v.string()),
    orderedIds: v.array(v.id("productImages")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireActiveVariant(ctx, args.variantId);
    const group = (await imagesForRole(ctx, variant.variantId, args.role)).filter((r) => r.colorway === args.colorway);

    const wanted = new Set<string>(args.orderedIds);
    if (wanted.size !== args.orderedIds.length || wanted.size !== group.length || !group.every((r) => wanted.has(r._id))) {
      throw imageRuleError("invalid_order");
    }

    const before = [...group].sort((a, b) => a.order - b.order).map((r) => r._id);
    for (const [order, id] of args.orderedIds.entries()) {
      const row = group.find((r) => r._id === id);
      if (row && row.order !== order) await ctx.db.patch("productImages", id, { order });
    }
    await recordCatalogEvent(ctx, {
      variantId: variant.variantId,
      type: "images_reordered",
      actor,
      changes: [{ field: "order", from: before, to: args.orderedIds }],
    });
    return null;
  },
});

export const listProductImages = query({
  args: { variantId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("productImages"),
      _creationTime: v.number(),
      variantId: v.string(),
      colorway: v.optional(v.string()),
      role: imageRoleValidator,
      angle: v.optional(capAngleValidator),
      order: v.number(),
      storageId: v.id("_storage"),
      sha256: v.string(),
      width: v.number(),
      height: v.number(),
      createdAt: v.number(),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const out = [];
    for (const role of ["catalog", "lifestyle", "angle"] as const) {
      for (const row of await imagesForRole(ctx, args.variantId, role)) {
        out.push({ ...row, url: await ctx.storage.getUrl(row.storageId) });
      }
    }
    return out;
  },
});

/** Delete a replaced or removed file unless a row or a variant still points at it. */
export const deleteStorageFile = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await isStorageIdReferenced(ctx, args.storageId))) await deleteStorageQuietly(ctx, args.storageId);
    return null;
  },
});
