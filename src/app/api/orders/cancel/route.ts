import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);

    // Call Convex cancelOrder mutation to update status and restore inventory
    const result = await convex.mutation(api.orders.cancelOrder, {
      orderId: orderId as Id<"orders">,
      clerkUserId: userId,
      reason: reason || "Customer self-service cancellation",
    });

    // If order was paid via Stripe, process real Stripe refund
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    let refundIssued = false;

    if (stripeKey && result.stripeSessionId) {
      try {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2025-02-24.acacia" as any,
        });

        const session = await stripe.checkout.sessions.retrieve(result.stripeSessionId);

        if (session.payment_intent) {
          await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: "requested_by_customer",
            metadata: {
              orderNumber: result.orderNumber,
              clerkUserId: userId,
            },
          });
          refundIssued = true;
        }
      } catch (stripeErr: any) {
        console.error("Stripe refund error:", stripeErr);
        // Even if Stripe refund fails or test token, Convex state is updated
      }
    }

    return NextResponse.json({
      success: true,
      message: refundIssued
        ? "Order cancelled and full refund initiated to your original payment method."
        : "Order cancelled and stock restored.",
      orderNumber: result.orderNumber,
    });
  } catch (error: any) {
    console.error("Order cancellation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}
