import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { clerkUsersWebhook } from "./users/clerkWebhook";
import { oneClickUnsubscribe, unsubscribeRedirect } from "./notifications/unsubscribeHttp";
import { UNSUBSCRIBE_HTTP_PATH } from "./notifications/unsubscribe";
import { optOutOfReviewInvites, reviewInviteOptOutPage } from "./reviews/invitesHttp";
import { REVIEW_INVITE_UNSUBSCRIBE_PATH } from "./reviews/model";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature") || "";
    const payload = await request.text();

    try {
      await ctx.runAction(internal.payments.webhook.fulfillStripeWebhook, {
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
  handler: clerkUsersWebhook,
});

/** Marketing email `List-Unsubscribe`: one-click POST (RFC 8058) and a GET that redirects to the page. */
http.route({ path: UNSUBSCRIBE_HTTP_PATH, method: "POST", handler: oneClickUnsubscribe });
http.route({ path: UNSUBSCRIBE_HTTP_PATH, method: "GET", handler: unsubscribeRedirect });

/** Review invite opt-out: POST is one-click (RFC 8058); GET only shows a confirm button, so prefetching scanners opt nobody out. */
http.route({ path: REVIEW_INVITE_UNSUBSCRIBE_PATH, method: "POST", handler: optOutOfReviewInvites });
http.route({ path: REVIEW_INVITE_UNSUBSCRIBE_PATH, method: "GET", handler: reviewInviteOptOutPage });

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

      const result = await ctx.runMutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
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


