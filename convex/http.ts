import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { clerkUsersWebhook } from "./users/clerkWebhook";
import { oneClickUnsubscribe, unsubscribeRedirect } from "./notifications/unsubscribeHttp";
import { UNSUBSCRIBE_HTTP_PATH } from "./notifications/unsubscribe";
import { optOutOfReviewInvites, reviewInviteOptOutPage } from "./reviews/invitesHttp";
import { REVIEW_INVITE_UNSUBSCRIBE_PATH } from "./reviews/model";
import { authorizeShippoRequest, parseShippoTracking } from "./shipping/shippoWebhook";

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
      // Details stay in the log: the body reaches whoever sent the request (L1).
      return new Response("Webhook processing error", { status: 400 });
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
    const auth = authorizeShippoRequest(new URL(request.url), request.headers, process.env.SHIPPO_WEBHOOK_SECRET);
    if (auth === "unconfigured") {
      console.error("[ShippoWebhook] SHIPPO_WEBHOOK_SECRET is not set; refusing tracking events.");
      return new Response("Webhook not configured", { status: 500 });
    }
    if (auth === "unauthorized") {
      console.warn("[ShippoWebhook] Unauthorized webhook request received.");
      return new Response("Unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }
    const parsed = parseShippoTracking(body);
    if (parsed.kind === "ignored") {
      console.warn("[ShippoWebhook] Missing tracking_number in payload");
      return Response.json({ received: true, ignored: true, reason: parsed.reason });
    }

    try {
      const result = await ctx.runMutation(internal.orders.fulfillment.handleTrackingWebhookInternal, parsed.tracking);
      return Response.json({ received: true, ...result });
    } catch (err: any) {
      console.error("[ShippoWebhook] Error processing tracking webhook:", err?.message || err);
      return new Response("Webhook processing error", { status: 400 });
    }
  }),
});

export default http;


