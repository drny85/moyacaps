"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_CLERK_ID } from "./auth";
import { Shippo } from "shippo";

/**
 * Good Luck Atelier Studio - Official Dispatch Center
 */
export const ATELIER_ORIGIN_ADDRESS = {
  name: "Good Luck Atelier",
  company: "Good Luck 0880",
  street1: "1 Broadway",
  city: "New York",
  state: "NY",
  zip: "10004",
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

async function verifyAdminInAction(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized: Staff authentication required to access shipping operations.");
  }
  const email = identity.email?.toLowerCase() || "";
  const tokenIdentifier = identity.tokenIdentifier || "";
  const clerkId = identity.subject;

  if (
    email === PRIMARY_ADMIN_EMAIL ||
    tokenIdentifier.includes(PRIMARY_ADMIN_CLERK_ID) ||
    clerkId === PRIMARY_ADMIN_CLERK_ID
  ) {
    return identity;
  }

  const adminUser = await ctx.runQuery(api.users.getUserByClerkId, { clerkId });
  if (adminUser?.role !== "admin") {
    throw new ConvexError("Unauthorized: Administrator privileges required for shipping operations.");
  }
  return identity;
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
}

const parcelValidator = v.optional(
  v.object({
    length: v.number(),
    width: v.number(),
    height: v.number(),
    weight: v.number(),
    unit: v.string(),
  })
);

/**
 * Fetch live commercial shipping rates from carriers (USPS, UPS, DHL Express) via Shippo.
 * Includes automatic packaging preset recommendation based on cap quantity.
 */
export const getShippingRates = action({
  args: {
    orderId: v.id("orders"),
    parcel: parcelValidator,
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    rates: FormattedRate[];
    parcel: { length: number; width: number; height: number; weight: number; unit: string };
    destination: { name?: string; address: string; city: string; state: string; postalCode: string; country: string };
    isSandbox: boolean;
    error?: string;
  }> => {
    await verifyAdminInAction(ctx);

    const order = await ctx.runQuery(internal.orders.getOrderByIdInternal, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new ConvexError(`Order not found: ${args.orderId}`);
    }

    if (!order.shippingAddress) {
      throw new ConvexError("This order does not have a destination shipping address.");
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
      },
    ];

    return {
      success: true,
      rates: simulatedRates,
      parcel,
      destination: destSummary,
      isSandbox: true,
    };
  },
});

/**
 * Purchases postage label for an order, downloads the official 4x6 / 8.5x11 PDF,
 * marks order as dispatched, updates tracking, and dispatches the customer email.
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
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    trackingNumber: string;
    labelUrl: string;
    carrier: string;
    serviceLevel?: string;
    isSandbox: boolean;
  }> => {
    const adminIdentity = await verifyAdminInAction(ctx);

    const order = await ctx.runQuery(internal.orders.getOrderByIdInternal, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new ConvexError(`Order not found: ${args.orderId}`);
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

    // Attach to order in database & trigger fulfillment notifications
    await ctx.runMutation(internal.orders.attachShippingLabelInternal, {
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
    });

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
