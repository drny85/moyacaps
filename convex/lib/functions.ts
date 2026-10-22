/**
 * The app's mutation builders. Every mutation is registered through these, never straight
 * from `_generated/server`, so table triggers run on every write: an order insert, patch or
 * delete keeps the dashboard's `orderStats` aggregate in the same transaction (M8), and a
 * drop_alerts write keeps `dropAlertStats` (L6).
 * functions.test.ts fails the build when a module imports the raw builders.
 */
import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "../_generated/dataModel";
import { internalMutation as rawInternalMutation, mutation as rawMutation } from "../_generated/server";
import { orderStats } from "../analytics/orderStats";
import { dropAlertStats } from "../catalog/dropAlertStats";

const triggers = new Triggers<DataModel>();
// Idempotent: an order written before `backfillOrderStats` reached it is inserted, not rejected.
triggers.register("orders", orderStats.idempotentTrigger());
// Same for the Drop Radar's per-product sign-up counts (L6).
triggers.register("drop_alerts", dropAlertStats.idempotentTrigger());

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB));
