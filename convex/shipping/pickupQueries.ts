/**
 * USPS Package Pickup data: the labelled packages waiting for the carrier and the pickups already
 * scheduled. The rules live in ./pickupPlan.ts; the Shippo call is in ./pickups.ts (Node).
 */
import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { groupPickupCandidates, pickupBlocksDate, pickupLocationValidator, type PickupCandidate } from "./pickupPlan";
import { currentHandoff, isReadyToShip } from "../orders/handoff";

/** Labelled Orders read per desk load; a busy day is a few dozen. */
const WAITING_LIMIT = 100;
const UPCOMING_LIMIT = 10;

const candidateValidator = v.object({
  orderId: v.id("orders"),
  orderNumber: v.string(),
  customerName: v.optional(v.string()),
  carrier: v.optional(v.string()),
  serviceLevel: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  rateId: v.optional(v.string()),
});

type Candidate = PickupCandidate & { orderId: Doc<"orders">["_id"] };

const pickupValidator = v.object({
  _id: v.id("pickups"),
  pickupDate: v.string(),
  requestedStartTime: v.number(),
  requestedEndTime: v.number(),
  location: pickupLocationValidator,
  instructions: v.optional(v.string()),
  packages: v.number(),
  status: v.string(),
  confirmationCode: v.optional(v.string()),
  cancelByTime: v.optional(v.string()),
  timezone: v.optional(v.string()),
  simulated: v.boolean(),
  // Its packages still Ready to Ship with no Handoff: "Mark picked up" covers these (ADR 0030).
  awaitingHandoff: v.array(v.object({ orderId: v.id("orders"), orderNumber: v.string() })),
});

/** Pickups on or after `today`, soonest first. */
async function upcomingPickups(ctx: QueryCtx, today: string): Promise<Doc<"pickups">[]> {
  return await ctx.db
    .query("pickups")
    .withIndex("by_pickupDate", (q) => q.gte("pickupDate", today))
    .take(UPCOMING_LIMIT);
}

/**
 * Ready to Ship Orders (labelled, unscanned, sale still standing: ../orders/handoff.ts), minus
 * those already on a pickup still to come.
 */
async function waitingPackages(ctx: QueryCtx, today: string): Promise<Candidate[]> {
  const scheduled = new Set<string>();
  for (const p of await upcomingPickups(ctx, today)) {
    if (pickupBlocksDate(p.status)) for (const id of p.orderIds) scheduled.add(id);
  }
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_fulfillmentStatus", (q) => q.eq("fulfillmentStatus", "label_purchased"))
    .order("desc")
    .take(WAITING_LIMIT);
  return orders
    .filter((o) => isReadyToShip(o) && !scheduled.has(o._id))
    .map((o) => ({
      orderId: o._id,
      orderNumber: o.orderNumber,
      ...(o.customerName !== undefined && { customerName: o.customerName }),
      ...((o.shippingCarrier ?? o.carrier) !== undefined && { carrier: o.shippingCarrier ?? o.carrier }),
      ...(o.shippingServiceLevel !== undefined && { serviceLevel: o.shippingServiceLevel }),
      ...(o.shippingTransactionId !== undefined && { transactionId: o.shippingTransactionId }),
      ...(o.shippingRateId !== undefined && { rateId: o.shippingRateId }),
    }));
}

/** A pickup's packages the carrier has not scanned and nobody marked handed off yet. */
async function awaitingHandoff(ctx: QueryCtx, pickup: Doc<"pickups">) {
  const orders = await Promise.all(pickup.orderIds.map((id) => ctx.db.get(id)));
  return orders
    .filter((o): o is Doc<"orders"> => o !== null && isReadyToShip(o) && !currentHandoff(o))
    .map((o) => ({ orderId: o._id, orderNumber: o.orderNumber }));
}

async function dateIsTaken(ctx: QueryCtx, pickupDate: string): Promise<boolean> {
  const rows = await ctx.db
    .query("pickups")
    .withIndex("by_pickupDate", (q) => q.eq("pickupDate", pickupDate))
    .take(UPCOMING_LIMIT);
  return rows.some((p) => pickupBlocksDate(p.status));
}

/** Admin: the Pickup card on the Orders desk. `today` is the Administrator's local day. */
export const pickupDesk = query({
  args: { today: v.string() },
  returns: v.object({
    api: v.array(candidateValidator),
    uspsSite: v.array(candidateValidator),
    upcoming: v.array(pickupValidator),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const groups = groupPickupCandidates(await waitingPackages(ctx, args.today));
    const upcoming = (await upcomingPickups(ctx, args.today)).filter((p) => pickupBlocksDate(p.status));
    const awaiting = await Promise.all(upcoming.map((p) => awaitingHandoff(ctx, p)));
    return {
      ...groups,
      upcoming: upcoming.map((p, i) => ({
        _id: p._id,
        pickupDate: p.pickupDate,
        requestedStartTime: p.requestedStartTime,
        requestedEndTime: p.requestedEndTime,
        location: p.location,
        ...(p.instructions !== undefined && { instructions: p.instructions }),
        packages: p.orderIds.length,
        status: p.status,
        ...(p.confirmationCode !== undefined && { confirmationCode: p.confirmationCode }),
        ...(p.cancelByTime !== undefined && { cancelByTime: p.cancelByTime }),
        ...(p.timezone !== undefined && { timezone: p.timezone }),
        simulated: p.simulated,
        awaitingHandoff: awaiting[i],
      })),
    };
  },
});

/** For the schedule action: the packages Shippo can take and whether the day is already used. */
export const pickupContextInternal = internalQuery({
  args: { today: v.string(), pickupDate: v.string() },
  returns: v.object({ api: v.array(candidateValidator), alreadyScheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const { api } = groupPickupCandidates(await waitingPackages(ctx, args.today));
    return { api, alreadyScheduled: await dateIsTaken(ctx, args.pickupDate) };
  },
});

/** Records a pickup Shippo accepted. Re-checks the one-per-day rule inside the transaction. */
export const recordPickupInternal = internalMutation({
  args: {
    pickupDate: v.string(),
    requestedStartTime: v.number(),
    requestedEndTime: v.number(),
    location: pickupLocationValidator,
    instructions: v.optional(v.string()),
    orderIds: v.array(v.id("orders")),
    transactionIds: v.array(v.string()),
    status: v.string(),
    confirmationCode: v.optional(v.string()),
    confirmedStartTime: v.optional(v.string()),
    confirmedEndTime: v.optional(v.string()),
    cancelByTime: v.optional(v.string()),
    timezone: v.optional(v.string()),
    shippoPickupId: v.optional(v.string()),
    simulated: v.boolean(),
    actor: v.string(),
  },
  returns: v.id("pickups"),
  handler: async (ctx, args) => {
    if (pickupBlocksDate(args.status) && (await dateIsTaken(ctx, args.pickupDate))) {
      throw new ConvexError(
        `Another pickup was recorded for ${args.pickupDate} meanwhile. Check Shippo for duplicate confirmation codes.`
      );
    }
    return await ctx.db.insert("pickups", { ...args, createdAt: Date.now() });
  },
});
