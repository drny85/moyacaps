"use node";

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Shippo } from "shippo";
import { requireAdminInAction } from "../lib/auth";
import { parseShipFrom, shipFromMissingMessage } from "./shipFrom";
import { currentShippoPolicy, getShippoClient } from "./shippoClient";
import {
  carrierWallClock,
  pickupAddress,
  pickupDiagnostics,
  pickupFailureMessage,
  pickupLocationValidator,
  planPickupMode,
  planPickupRequest,
} from "./pickupPlan";

/**
 * The USPS carrier account to schedule on: the one a waiting label was bought with (read from
 * its Shippo rate), so the pickup and its labels match. Without a readable rate:
 * SHIPPO_USPS_CARRIER_ACCOUNT when set, otherwise the first active USPS account on the key.
 */
async function uspsCarrierAccount(shippo: Shippo, rateIds: string[]): Promise<string> {
  for (const rateId of rateIds) {
    try {
      const rate = await shippo.rates.get(rateId);
      if (rate.carrierAccount) return rate.carrierAccount;
    } catch (err: any) {
      console.warn(`[Shippo] Could not read rate ${rateId} for its carrier account:`, err?.message || err);
    }
  }
  const configured = process.env.SHIPPO_USPS_CARRIER_ACCOUNT?.trim();
  if (configured) return configured;
  const list = await shippo.carrierAccounts.list({ carrier: "usps" });
  const account = (list.results ?? []).find((a) => a.active !== false && a.objectId);
  if (!account?.objectId) {
    throw new ConvexError("No active USPS carrier account was found on this Shippo key. Set SHIPPO_USPS_CARRIER_ACCOUNT.");
  }
  return account.objectId;
}

/**
 * Admin: asks USPS (through Shippo) to collect every waiting Priority Mail and international
 * package on `pickupDate`. Ground Advantage packages are scheduled on usps.com, or left out with
 * these for the same stop. USPS takes one request per address per day (./pickupPlan.ts).
 */
export const schedulePickup = action({
  args: {
    today: v.string(),
    pickupDate: v.string(),
    requestedStartTime: v.number(),
    requestedEndTime: v.number(),
    location: pickupLocationValidator,
    instructions: v.optional(v.string()),
  },
  returns: v.object({
    status: v.string(),
    confirmationCode: v.optional(v.string()),
    packages: v.number(),
    simulated: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ status: string; confirmationCode?: string; packages: number; simulated: boolean }> => {
    const admin = await requireAdminInAction(ctx);
    const instructions = args.instructions?.trim().slice(0, 200) || undefined;

    const context = await ctx.runQuery(internal.shipping.pickupQueries.pickupContextInternal, {
      today: args.today,
      pickupDate: args.pickupDate,
    });
    const plan = planPickupRequest({
      pickupDate: args.pickupDate,
      requestedStartTime: args.requestedStartTime,
      requestedEndTime: args.requestedEndTime,
      location: args.location,
      instructions,
      apiCount: context.api.length,
      alreadyScheduled: context.alreadyScheduled,
      nowMs: Date.now(),
    });
    if (!plan.ok) throw new ConvexError(plan.error);

    const transactionIds = context.api.map((c) => c.transactionId!);
    const mode = planPickupMode(currentShippoPolicy(), transactionIds);
    if (!mode.ok) throw new ConvexError(mode.error);

    let result: {
      status: string;
      confirmationCode?: string;
      confirmedStartTime?: string;
      confirmedEndTime?: string;
      cancelByTime?: string;
      timezone?: string;
      shippoPickupId?: string;
    };

    const shippo = getShippoClient();
    if (shippo && !mode.simulated) {
      const parsed = parseShipFrom(process.env);
      if (!parsed.ok) throw new ConvexError(shipFromMissingMessage(parsed.missing));
      // What was sent, for the failure log (no address or contact details).
      let sent = { carrierAccount: "", requestedStartTime: "", requestedEndTime: "", transactions: transactionIds.length };
      try {
        const rateIds = context.api.flatMap((c) => (c.rateId ? [c.rateId] : []));
        const carrierAccount = await uspsCarrierAccount(shippo, rateIds);
        // Shippo reads these as the pickup address's local clock (./pickupPlan carrierWallClock).
        const requestedStartTime = carrierWallClock(args.requestedStartTime);
        const requestedEndTime = carrierWallClock(args.requestedEndTime);
        sent = {
          carrierAccount,
          requestedStartTime: requestedStartTime.toISOString(),
          requestedEndTime: requestedEndTime.toISOString(),
          transactions: transactionIds.length,
        };
        const pickup = await shippo.pickups.create({
          carrierAccount,
          location: {
            address: pickupAddress(parsed.address),
            buildingLocationType: args.location,
            ...(instructions && { instructions }),
          },
          transactions: transactionIds,
          requestedStartTime,
          requestedEndTime,
          metadata: `moyacaps ${args.pickupDate}`,
        });
        if (pickup.status === "ERROR") {
          const echoed = JSON.stringify({
            object_id: pickup.objectId,
            status: pickup.status,
            carrier_account: pickup.carrierAccount,
            requested_start_time: pickup.requestedStartTime?.toISOString(),
            requested_end_time: pickup.requestedEndTime?.toISOString(),
            confirmed_start_time: pickup.confirmedStartTime,
            confirmed_end_time: pickup.confirmedEndTime,
            timezone: pickup.timezone,
            is_test: pickup.isTest,
            messages: pickup.messages ?? [],
          });
          console.warn("[Shippo] Pickup refused:", JSON.stringify(pickupDiagnostics(echoed, sent)));
          throw new ConvexError(
            pickupFailureMessage(JSON.stringify({ object_id: pickup.objectId, messages: pickup.messages ?? [] }))
          );
        }
        result = {
          status: pickup.status ?? "PENDING",
          confirmationCode: pickup.confirmationCode,
          confirmedStartTime: pickup.confirmedStartTime,
          confirmedEndTime: pickup.confirmedEndTime,
          cancelByTime: pickup.cancelByTime,
          timezone: pickup.timezone,
          shippoPickupId: pickup.objectId,
        };
      } catch (err: any) {
        if (err instanceof ConvexError) throw err;
        // Shippo answers a refused pickup with HTTP 400 and the pickup object as the body, address
        // included: log only the diagnostics, never the raw body or message.
        const body = typeof err?.body === "string" ? err.body : undefined;
        const httpStatus = typeof err?.statusCode === "number" ? err.statusCode : undefined;
        console.error("[Shippo] Pickup request failed:", JSON.stringify(pickupDiagnostics(body, sent, httpStatus)));
        throw new ConvexError(pickupFailureMessage(body));
      }
    } else {
      // Simulated pickup (development only, SHIPPO_ALLOW_SIMULATION=true).
      result = { status: "CONFIRMED", confirmationCode: `SIM${Date.now().toString().slice(-9)}` };
    }

    // Drop undefined fields: Convex validators reject them.
    const recorded = Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as typeof result;
    await ctx.runMutation(internal.shipping.pickupQueries.recordPickupInternal, {
      pickupDate: args.pickupDate,
      requestedStartTime: args.requestedStartTime,
      requestedEndTime: args.requestedEndTime,
      location: args.location,
      ...(instructions && { instructions }),
      orderIds: context.api.map((c) => c.orderId),
      transactionIds,
      ...recorded,
      simulated: mode.simulated,
      actor: admin.subject,
    });

    return {
      status: result.status,
      ...(result.confirmationCode && { confirmationCode: result.confirmationCode }),
      packages: transactionIds.length,
      simulated: mode.simulated,
    };
  },
});
