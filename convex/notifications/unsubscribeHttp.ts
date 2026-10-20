/**
 * The `List-Unsubscribe` URL of marketing email (notifications/unsubscribe.ts), served at
 * UNSUBSCRIBE_HTTP_PATH on the Convex site.
 *
 * - POST is RFC 8058 one-click: the mail client's own button. It opts out at once; the token in
 *   the query string is the only credential, and the body (`List-Unsubscribe=One-Click`) is
 *   not required.
 * - GET is a reader opening the link in a browser (older clients) or a link scanner prefetching
 *   it. It changes nothing and redirects to the storefront unsubscribe page.
 */
import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { unsubscribeLocale, unsubscribePageUrl } from "./unsubscribe";

export const oneClickUnsubscribe = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { status } = await ctx.runMutation(api.notifications.launchAlerts.unsubscribe, { token });
  if (status === "not_found") return new Response("Unknown unsubscribe link", { status: 404 });
  return new Response("Unsubscribed", { status: 200 });
});

export const unsubscribeRedirect = httpAction(async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
  const location = unsubscribePageUrl(siteUrl, unsubscribeLocale(params.get("locale")), params.get("token") ?? "");
  return new Response(null, { status: 303, headers: { Location: location } });
});
