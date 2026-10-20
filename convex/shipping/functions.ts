"use node";

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdminInAction } from "../lib/auth";
import { planLabelPurchase } from "../orders/status";
import { Shippo } from "shippo";
import { isExcludedTerritory } from "./territory";

/**
 * Good Luck Atelier Studio - Official Dispatch Center
 */
export const ATELIER_ORIGIN_ADDRESS = {
  name: "Good Luck Atelier",
  company: "Good Luck 0880",
  street1: "1450 Clay Ave",
  city: "Bronx",
  state: "NY",
  zip: "10456",
  country: "US",
  phone: "6462251912",
  email: "concierge@goodluckcaps.com",
};

/**
 * Specialized Cap Box Packaging Presets
 * Calibrated specifically for handcrafted structured caps to protect crowns.
 */
export const CAP_BOX_PRESETS = [
  {
    id: "one_cap",
    name: "1 Cap Standard Box",
    description: "Rigid protective box for 1 structured cap with crown insert",
    length: 8,
    width: 8,
    height: 6,
    weight: 8, // oz (~0.5 lb)
    unit: "in",
    massUnit: "oz" as const,
  },
  {
    id: "two_caps",
    name: "2 Caps Double Box",
    description: "Expanded box for 2 nested caps with silk dustbags",
    length: 10,
    width: 8,
    height: 6,
    weight: 13, // oz (~0.81 lb)
    unit: "in",
    massUnit: "oz" as const,
  },
  {
    id: "three_plus_caps",
    name: "3+ Caps Atelier Collector Box",
    description: "Heavy-duty luxury master carton for 3 to 4 caps",
    length: 12,
    width: 10,
    height: 8,
    weight: 20, // oz (1.25 lb)
    unit: "in",
    massUnit: "oz" as const,
  },
] as const;

export function getDefaultBoxPreset(itemsCount: number) {
  if (itemsCount <= 1) return CAP_BOX_PRESETS[0];
  if (itemsCount === 2) return CAP_BOX_PRESETS[1];
  return CAP_BOX_PRESETS[2];
}

/**
 * Detects whether an address is a Post Office Box.
 * Major commercial couriers (UPS, FedEx) cannot deliver to PO Boxes.
 */
export function isPoBoxAddress(line1?: string, line2?: string): boolean {
  const poBoxRegex = /\b(p\.?\s*o\.?\s*box|post\s*office\s*box|box\b\s*\d+)\b/i;
  return poBoxRegex.test(line1 || "") || poBoxRegex.test(line2 || "");
}

export function buildCarrierTrackingUrl(carrier?: string, trackingNumber?: string): string | null {
  if (!trackingNumber || trackingNumber.trim() === "") return null;
  const cleanTrk = trackingNumber.trim();
  const cleanCarrier = (carrier || "").toLowerCase();

  if (cleanCarrier.includes("usps") || cleanCarrier.includes("postal")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(cleanTrk)}`;
  }
  return null;
}


function getShippoClient(): Shippo | null {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "mock" || apiKey === "test_dummy") {
    return null;
  }
  return new Shippo({ apiKeyHeader: apiKey.trim() });
}

export interface FormattedRate {
  objectId: string;
  provider: string;
  providerImage?: string;
  serviceName: string;
  amount: number;
  currency: string;
  estimatedDays?: number;
  durationTerms?: string;
  attributes: string[];
  isCheapest?: boolean;
  isFastest?: boolean;
  isPoBoxIncompatible?: boolean;
  recommendedTag?: string;
}

const parcelDimensionsValidator = v.object({
  length: v.number(),
  width: v.number(),
  height: v.number(),
  weight: v.number(),
  unit: v.string(),
});

const parcelValidator = v.optional(parcelDimensionsValidator);

/** Return validator for FormattedRate. */
const formattedRateValidator = v.object({
  objectId: v.string(),
  provider: v.string(),
  providerImage: v.optional(v.string()),
  serviceName: v.string(),
  amount: v.number(),
  currency: v.string(),
  estimatedDays: v.optional(v.number()),
  durationTerms: v.optional(v.string()),
  attributes: v.array(v.string()),
  isCheapest: v.optional(v.boolean()),
  isFastest: v.optional(v.boolean()),
  isPoBoxIncompatible: v.optional(v.boolean()),
  recommendedTag: v.optional(v.string()),
});

/**
 * Fetch live commercial shipping rates from carriers (USPS, UPS, DHL Express) via Shippo.
 * Includes automatic packaging preset recommendation based on cap quantity.
 */
export const getShippingRates = action({
  args: {
    orderId: v.id("orders"),
    parcel: parcelValidator,
  },
  returns: v.object({
    success: v.boolean(),
    rates: v.array(formattedRateValidator),
    parcel: parcelDimensionsValidator,
    destination: v.object({
      name: v.optional(v.string()),
      address: v.string(),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
    }),
    isSandbox: v.boolean(),
    isPoBox: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    rates: FormattedRate[];
    parcel: { length: number; width: number; height: number; weight: number; unit: string };
    destination: { name?: string; address: string; city: string; state: string; postalCode: string; country: string };
    isSandbox: boolean;
    isPoBox: boolean;
    error?: string;
  }> => {
    await requireAdminInAction(ctx);

    const order = await ctx.runQuery(internal.orders.functions.getOrderByIdInternal, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new ConvexError(`Order not found: ${args.orderId}`);
    }

    if (!order.shippingAddress || !order.shippingAddress.line1) {
      return {
        success: false,
        rates: [],
        parcel: { length: 8, width: 8, height: 6, weight: 8, unit: "in" },
        destination: { name: order.customerName, address: "", city: "", state: "", postalCode: "", country: "US" },
        isSandbox: false,
        isPoBox: false,
        error: "This order does not have a destination shipping address. Please enter the delivery address below.",
      };
    }

    const { line1, line2, city, state, postalCode, country } = order.shippingAddress;

    const destSummary = {
      name: order.customerName,
      address: line2 ? `${line1}, ${line2}` : line1,
      city,
      state,
      postalCode,
      country: country || "US",
    };

    // 1. Fulfillment Territory check (50 US States + DC; see ./territory)
    const territoryCheck = isExcludedTerritory(state, postalCode, country);
    if (territoryCheck.isExcluded) {
      return {
        success: false,
        rates: [],
        parcel: { length: 8, width: 8, height: 6, weight: 8, unit: "in" },
        destination: destSummary,
        isSandbox: false,
        isPoBox: false,
        error: territoryCheck.reason || "Address is outside the supported fulfillment territory.",
      };
    }

    // 2. PO Box Address Check
    const isPoBox = isPoBoxAddress(line1, line2);

    // Calculate or take parcel dimensions
    const totalCaps = (order.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);
    const defaultPreset = getDefaultBoxPreset(totalCaps);

    const parcel = args.parcel || {
      length: defaultPreset.length,
      width: defaultPreset.width,
      height: defaultPreset.height,
      weight: defaultPreset.weight,
      unit: "in",
    };

    const shippo = getShippoClient();

    if (shippo) {
      try {
        const shipment = await shippo.shipments.create({
          addressFrom: ATELIER_ORIGIN_ADDRESS,
          addressTo: {
            name: order.customerName || "Valued Collector",
            company: "",
            street1: line1,
            street2: line2 || undefined,
            city,
            state,
            zip: postalCode,
            country: country || "US",
            email: order.customerEmail || "concierge@goodluckcaps.com",
            phone: (order.customerPhone || "6462251912").replace(/[^\d]/g, "").slice(-10) || "6462251912",
          },
          parcels: [
            {
              length: String(parcel.length),
              width: String(parcel.width),
              height: String(parcel.height),
              distanceUnit: "in",
              weight: String(parcel.weight),
              massUnit: "oz",
            },
          ],
          async: false,
        });

        const rawRates = shipment.rates || [];

        if (rawRates.length > 0) {
          const formattedRates: FormattedRate[] = rawRates.map((r: any) => {
            const amountNum = parseFloat(r.amount || "0");
            const attrs = r.attributes || [];
            const providerUpper = (r.provider || "").toUpperCase();
            const isCarrierUpsOrFedex = providerUpper.includes("UPS") || providerUpper.includes("FEDEX");
            const isPoBoxIncompatible = isPoBox && isCarrierUpsOrFedex;

            let recommendedTag: string | undefined = undefined;
            if (totalCaps <= 2 && providerUpper.includes("USPS") && attrs.includes("CHEAPEST")) {
              recommendedTag = "Standard (Free Daily Pickup)";
            } else if (totalCaps >= 3 && providerUpper.includes("UPS") && !isPoBox) {
              recommendedTag = "Rigid Box Protection (Guaranteed Ground)";
            }

            return {
              objectId: r.objectId,
              provider: r.provider || "Carrier",
              providerImage: r.providerImage75 || undefined,
              serviceName: r.servicelevel?.name || r.provider || "Standard Shipping",
              amount: amountNum,
              currency: r.currency || "USD",
              estimatedDays: r.estimatedDays || undefined,
              durationTerms: r.durationTerms || undefined,
              attributes: attrs,
              isCheapest: attrs.includes("CHEAPEST"),
              isFastest: attrs.includes("FASTEST"),
              isPoBoxIncompatible,
              recommendedTag,
            };
          });

          // Sort by price ascending
          formattedRates.sort((a, b) => a.amount - b.amount);

          return {
            success: true,
            rates: formattedRates,
            parcel,
            destination: destSummary,
            isSandbox: false,
            isPoBox,
          };
        }
      } catch (err: any) {
        console.warn("[Shippo] Live rates API request returned error, falling back to sandbox mode:", err?.message || err);
      }
    }

    // Fallback sandbox simulation rates with commercial discount benchmarks
    const isHeavy = parcel.weight > 16;
    const baseUspsPrice = isHeavy ? 8.95 : 5.85;
    const baseUpsPrice = isHeavy ? 10.45 : 8.45;

    const simulatedRates: FormattedRate[] = [
      {
        objectId: `sim_usps_ground_${order._id}`,
        provider: "USPS",
        providerImage: "https://assets.goshippo.com/carrier_logos/75/usps.png",
        serviceName: "USPS Ground Advantage",
        amount: baseUspsPrice,
        currency: "USD",
        estimatedDays: 3,
        durationTerms: "2-5 business days",
        attributes: ["CHEAPEST"],
        isCheapest: true,
        isPoBoxIncompatible: false,
        recommendedTag: !isHeavy ? "Standard (Free Daily Pickup)" : undefined,
      },
      {
        objectId: `sim_ups_ground_${order._id}`,
        provider: "UPS",
        providerImage: "https://assets.goshippo.com/carrier_logos/75/ups.png",
        serviceName: "UPS Ground",
        amount: baseUpsPrice,
        currency: "USD",
        estimatedDays: 3,
        durationTerms: "1-4 business days",
        attributes: ["BESTVALUE"],
        isPoBoxIncompatible: isPoBox,
        recommendedTag: isHeavy && !isPoBox ? "Rigid Box Protection (Guaranteed Ground)" : undefined,
      },
      {
        objectId: `sim_usps_priority_${order._id}`,
        provider: "USPS",
        providerImage: "https://assets.goshippo.com/carrier_logos/75/usps.png",
        serviceName: "USPS Priority Mail",
        amount: +(baseUspsPrice + 3.4).toFixed(2),
        currency: "USD",
        estimatedDays: 2,
        durationTerms: "1-3 business days",
        attributes: ["FASTEST"],
        isFastest: true,
        isPoBoxIncompatible: false,
        recommendedTag: isHeavy ? "USPS Postal Priority" : undefined,
      },
      {
        objectId: `sim_ups_2day_${order._id}`,
        provider: "UPS",
        providerImage: "https://assets.goshippo.com/carrier_logos/75/ups.png",
        serviceName: "UPS 2nd Day Air",
        amount: +(baseUpsPrice + 8.2).toFixed(2),
        currency: "USD",
        estimatedDays: 2,
        durationTerms: "2 business days guaranteed",
        attributes: [],
        isPoBoxIncompatible: isPoBox,
      },
    ];

    return {
      success: true,
      rates: simulatedRates,
      parcel,
      destination: destSummary,
      isSandbox: true,
      isPoBox,
    };
  },
});

/**
 * Purchases a postage label for an order (or a Reship: a new label after a Delivery Exception
 * or a return to sender), records it in the order's label history, moves Fulfillment Status to
 * label purchased and dispatches the customer email. Refused unless the order is paid (or
 * partially refunded), not cancelled, not disputed and unfulfilled (orders/status.ts
 * planLabelPurchase). Never moves stock. If the order changed while the label was being bought
 * and the label cannot be attached, the label is voided with Shippo.
 */
export const buyShippingLabel = action({
  args: {
    orderId: v.id("orders"),
    rateObjectId: v.string(),
    labelFileType: v.optional(v.string()), // "PDF_4x6" | "PDF"
    carrier: v.optional(v.string()),
    serviceLevel: v.optional(v.string()),
    amount: v.optional(v.number()),
    estimatedDays: v.optional(v.number()),
    parcel: parcelValidator,
    reship: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    trackingNumber: v.string(),
    labelUrl: v.string(),
    carrier: v.string(),
    serviceLevel: v.optional(v.string()),
    isSandbox: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    trackingNumber: string;
    labelUrl: string;
    carrier: string;
    serviceLevel?: string;
    isSandbox: boolean;
  }> => {
    const adminIdentity = await requireAdminInAction(ctx);

    const order = await ctx.runQuery(internal.orders.functions.getOrderByIdInternal, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new ConvexError(`Order not found: ${args.orderId}`);
    }

    // Refuse before paying the carrier: the label could not be attached (ADR 0024).
    const labelPlan = planLabelPurchase(order, { reship: args.reship });
    if (!labelPlan.ok) {
      throw new ConvexError(labelPlan.error);
    }

    if (order.shippingAddress) {
      // 1. Territory boundary validation
      const territoryCheck = isExcludedTerritory(
        order.shippingAddress.state,
        order.shippingAddress.postalCode,
        order.shippingAddress.country
      );
      if (territoryCheck.isExcluded) {
        throw new ConvexError(territoryCheck.reason || "Destination address is outside supported fulfillment territory.");
      }

      // 2. PO Box courier restriction
      const isPoBox = isPoBoxAddress(order.shippingAddress.line1, order.shippingAddress.line2);
      const chosenCarrierUpper = (args.carrier || "").toUpperCase();
      if (isPoBox && (chosenCarrierUpper.includes("UPS") || chosenCarrierUpper.includes("FEDEX"))) {
        throw new ConvexError("Cannot purchase UPS/FedEx label for a P.O. Box address. Please select USPS Ground Advantage or Priority Mail.");
      }
    }

    const shippo = getShippoClient();
    const isSimulatedRate = args.rateObjectId.startsWith("sim_");

    let trackingNumber = "";
    let labelUrl = "";
    let chosenCarrier = args.carrier || "USPS";
    let isSandbox = false;
    let transactionId = "";

    if (shippo && !isSimulatedRate) {
      try {
        const labelFormat = args.labelFileType === "PDF" ? "PDF" : "PDF_4x6";
        const transaction: any = await shippo.transactions.create({
          rate: args.rateObjectId,
          labelFileType: labelFormat as any,
          async: false,
        });

        if (transaction.status !== "SUCCESS") {
          const errorMsg = (transaction.messages || []).map((m: any) => m.text).join(", ") || "Failed to purchase postage";
          throw new ConvexError(`Shippo Transaction Error: ${errorMsg}`);
        }

        trackingNumber = transaction.trackingNumber || "";
        labelUrl = transaction.labelUrl || "";
        transactionId = transaction.objectId || "";
        chosenCarrier = transaction.rate?.provider || chosenCarrier;
      } catch (err: any) {
        if (err instanceof ConvexError) throw err;
        console.error("[Shippo] Error buying label via API:", err?.message || err);
        throw new ConvexError(`Shipping label purchase failed: ${err?.message || String(err)}`);
      }
    } else {
      // Sandbox fallback mode: generate valid mock tracking & thermal label sample
      isSandbox = true;
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      if (chosenCarrier.toUpperCase().includes("UPS")) {
        trackingNumber = `1Z99999999${randomDigits}`;
      } else {
        trackingNumber = `9400111899${randomDigits}`;
      }
      transactionId = `sim_tx_${Date.now()}`;
      // Direct sample thermal PDF label from Shippo sandbox documentation
      labelUrl = "https://shippo-delivery-east.s3.amazonaws.com/9400111899223344556677.pdf";
    }

    const carrierTrackingUrl = buildCarrierTrackingUrl(chosenCarrier, trackingNumber) || undefined;

    // Attach to order in database & trigger fulfillment notifications. The mutation re-checks
    // the label rules: an order cancelled or disputed meanwhile refuses the label.
    try {
      await ctx.runMutation(internal.orders.fulfillment.attachShippingLabelInternal, {
        orderId: args.orderId,
        carrier: chosenCarrier,
        trackingNumber,
        shippingLabelUrl: labelUrl,
        shippingRateId: args.rateObjectId,
        shippingTransactionId: transactionId,
        shippingServiceLevel: args.serviceLevel,
        shippingCost: args.amount,
        shippingEstimatedDays: args.estimatedDays,
        shippingLabelFileType: args.labelFileType || "PDF_4x6",
        carrierTrackingUrl,
        parcelDimensions: args.parcel,
        actor: adminIdentity.subject,
        reship: args.reship,
      });
    } catch (err) {
      if (shippo && !isSandbox && transactionId) {
        try {
          await shippo.refunds.create({ transaction: transactionId, async: false });
          console.warn(`[Shippo] Voided label ${transactionId}: it could not be attached to order ${args.orderId}.`);
        } catch (voidErr: any) {
          console.error(`[Shippo] Could not void unattached label ${transactionId}; void it in Shippo:`, voidErr?.message || voidErr);
        }
      }
      throw err;
    }

    return {
      success: true,
      trackingNumber,
      labelUrl,
      carrier: chosenCarrier,
      serviceLevel: args.serviceLevel,
      isSandbox,
    };
  },
});
