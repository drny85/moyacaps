import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import type { FieldChange } from "./audit";

const fieldChange = v.object({ field: v.string(), from: v.any(), to: v.any() });

const HISTORY_LIMIT = 50;

/** Latest audit events for one variant, newest first. `changes` is already parsed. */
export const getVariantHistory = query({
  args: { variantId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("catalog_events"),
      type: v.string(),
      actor: v.string(),
      createdAt: v.number(),
      changes: v.array(fieldChange),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const events = await ctx.db
      .query("catalog_events")
      .withIndex("by_variantId_and_createdAt", (q) => q.eq("variantId", args.variantId))
      .order("desc")
      .take(HISTORY_LIMIT);
    return events.map((e) => ({
      _id: e._id,
      type: e.type,
      actor: e.actor,
      createdAt: e.createdAt,
      // JSON drops undefined, so an added/removed field arrives with no from/to: show null.
      changes: e.changes
        ? (JSON.parse(e.changes) as FieldChange[]).map((c) => ({
            field: c.field,
            from: c.from ?? null,
            to: c.to ?? null,
          }))
        : [],
    }));
  },
});
