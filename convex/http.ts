import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Webhook } from "svix";
import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_CLERK_ID } from "./auth";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature") || "";
    const payload = await request.text();

    try {
      await ctx.runAction(internal.stripe.fulfillStripeWebhook, {
        payload,
        signature,
      });

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Error processing Stripe webhook in Convex:", err?.message || err);
      return new Response(err?.message || "Webhook processing error", { status: 400 });
    }
  }),
});

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    const payload = await request.text();

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    let event: any;

    if (webhookSecret) {
      if (!svixId || !svixTimestamp || !svixSignature) {
        return new Response("Missing svix headers", { status: 400 });
      }

      const wh = new Webhook(webhookSecret);
      try {
        event = wh.verify(payload, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (err: any) {
        console.error("Error verifying Clerk webhook:", err?.message || err);
        return new Response("Invalid webhook signature", { status: 400 });
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        return new Response("Webhook secret unconfigured in production", { status: 500 });
      }
      try {
        event = JSON.parse(payload);
      } catch {
        return new Response("Invalid JSON payload", { status: 400 });
      }
    }

    try {
      const eventType = event.type;
      const data = event.data;

      if (eventType === "user.created" || eventType === "user.updated") {
        const clerkId = data.id;
        const primaryEmailObj = data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id
        ) || data.email_addresses?.[0];

        const email = primaryEmailObj?.email_address?.toLowerCase() || "";
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || undefined;
        const imageUrl = data.image_url || undefined;
        const phone = data.phone_numbers?.[0]?.phone_number || undefined;

        // SECURITY: admin is granted ONLY by the allowlist below. Clerk publicMetadata is
        // client-writable, so data.public_metadata?.role must NEVER confer admin rights.
        const isAdmin =
          email === PRIMARY_ADMIN_EMAIL.toLowerCase() ||
          clerkId === PRIMARY_ADMIN_CLERK_ID;

        // Admins never lose access through webhook chatter: upsertUser refuses to demote
        // an established admin row. Removal is a deliberate act via the auth.ts allowlist.
        const role = isAdmin ? "admin" : "customer";

        await ctx.runMutation(internal.users.upsertUser, {
          clerkId,
          email,
          name,
          role,
          imageUrl,
          phone,
        });
      } else if (eventType === "user.deleted") {
        const clerkId = data.id;
        if (clerkId) {
          await ctx.runMutation(internal.users.softDeleteUser, { clerkId });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Error executing Clerk webhook action:", err?.message || err);
      return new Response(err?.message || "Webhook processing error", { status: 500 });
    }
  }),
});

/**
 * Shippo Carrier Tracking Webhook:
 * Automatically marks orders DELIVERED upon carrier scan, updates transit history,
 * sends celebratory customer delivery emails, and alerts admin on transit exceptions.
 */
http.route({
  path: "/shippo-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const webhookSecret = process.env.SHIPPO_WEBHOOK_SECRET;
      const url = new URL(request.url);
      const querySecret = url.searchParams.get("secret");
      const headerSecret =
        request.headers.get("x-shippo-secret") ||
        request.headers.get("shippo-secret") ||
        request.headers.get("x-webhook-secret");

      // Verify webhook secret if configured in environment
      if (webhookSecret) {
        const isAuthorized =
          querySecret === webhookSecret || headerSecret === webhookSecret;
        if (!isAuthorized) {
          console.warn("[ShippoWebhook] Unauthorized webhook request received.");
          return new Response("Unauthorized", { status: 401 });
        }
      }

      const bodyText = await request.text();
      if (!bodyText || bodyText.trim() === "") {
        return new Response("Empty body", { status: 400 });
      }

      const payload = JSON.parse(bodyText);
      const data = payload.data || payload;
      const trackingNumber = data.tracking_number;

      if (!trackingNumber) {
        console.warn("[ShippoWebhook] Missing tracking_number in payload");
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "missing_tracking_number" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const trackingStatusObj = data.tracking_status || {};
      const status = trackingStatusObj.status || data.status || "UNKNOWN";
      const statusDetails = trackingStatusObj.status_details || data.status_details;
      const statusDate = trackingStatusObj.status_date || data.status_date;
      const loc = trackingStatusObj.location || data.location;

      const result = await ctx.runMutation(internal.orders.handleTrackingWebhookInternal, {
        trackingNumber: String(trackingNumber).trim(),
        carrier: data.carrier || undefined,
        status: String(status),
        statusDetails: statusDetails ? String(statusDetails) : undefined,
        statusDate: statusDate ? String(statusDate) : undefined,
        location: loc
          ? {
              city: loc.city ? String(loc.city) : undefined,
              state: loc.state ? String(loc.state) : undefined,
              zip: loc.zip ? String(loc.zip) : undefined,
              country: loc.country ? String(loc.country) : undefined,
            }
          : undefined,
      });

      return new Response(JSON.stringify({ received: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[ShippoWebhook] Error processing tracking webhook:", err?.message || err);
      return new Response(err?.message || "Webhook processing error", { status: 400 });
    }
  }),
});

export default http;


