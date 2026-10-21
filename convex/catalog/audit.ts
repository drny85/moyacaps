import type { UserIdentity } from "convex/server";
import type { MutationCtx } from "../_generated/server";

export type CatalogEventType =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "stock_adjusted"
  | "sku_stock_set"
  | "price_set"
  | "featured_toggled"
  | "visibility_set"
  | "drop_changed"
  | "category_launch_set"
  | "home_tile_set"
  | "image_added"
  | "image_replaced"
  | "image_removed"
  | "images_reordered"
  | "settings_updated"
  | "purged";

export type FieldChange = { field: string; from: unknown; to: unknown };

// JSON compare; undefined and a missing key both serialize to nothing, so they compare equal.
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Fields whose value differs between two snapshots. Keys starting with `_` (system fields) are skipped. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: FieldChange[] = [];
  for (const field of keys) {
    if (field.startsWith("_")) continue;
    if (!same(before[field], after[field])) {
      changes.push({ field, from: before[field], to: after[field] });
    }
  }
  return changes;
}

export function actorEmail(identity: UserIdentity): string {
  return identity.email ?? identity.subject;
}

export async function recordCatalogEvent(
  ctx: MutationCtx,
  e: { variantId?: string; type: CatalogEventType; actor: string; changes?: FieldChange[] },
): Promise<void> {
  await ctx.db.insert("catalog_events", {
    variantId: e.variantId,
    type: e.type,
    actor: e.actor,
    changes: e.changes && e.changes.length > 0 ? JSON.stringify(e.changes) : undefined,
    createdAt: Date.now(),
  });
}
