import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    return NextResponse.json({ message: "Stripe key not configured" }, { status: 200 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia" as any,
  });

  const bodyText = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(bodyText, sig, webhookSecret);
    } else {
      event = JSON.parse(bodyText) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      try {
        const convex = new ConvexHttpClient(convexUrl);
        const shipping = (session as any).shipping_details || (session as any).shipping_cost;
        const address = shipping?.address || session.customer_details?.address;

        let parsedItems = [];
        try {
          if (metadata.itemsJson) {
            parsedItems = JSON.parse(metadata.itemsJson);
          }
        } catch (e) {
          console.error("Failed to parse itemsJson:", e);
        }

        await convex.mutation(api.orders.createOrUpdateStripeOrder, {
          stripeSessionId: session.id,
          orderNumber: metadata.orderNumber || `MC-${session.id.slice(-8).toUpperCase()}`,
          customerEmail: session.customer_details?.email || undefined,
          customerName: session.customer_details?.name || undefined,
          customerPhone: session.customer_details?.phone || undefined,
          clerkUserId: metadata.clerkUserId || undefined,
          shippingAddress: address
            ? {
                line1: address.line1 || "Street address",
                line2: address.line2 || undefined,
                city: address.city || "City",
                state: address.state || "",
                postalCode: address.postal_code || "",
                country: address.country || "US",
              }
            : undefined,
          items: parsedItems,
          currency: (session.currency || "usd").toUpperCase(),
          subtotal: metadata.subtotal ? Number(metadata.subtotal) : undefined,
          shippingFee: metadata.shippingFee ? Number(metadata.shippingFee) : undefined,
          total: (session.amount_total || 0) / 100,
        });

        console.log(`Order successfully synchronized for session ${session.id}`);
      } catch (err) {
        console.error("Failed to sync order to Convex in webhook:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
