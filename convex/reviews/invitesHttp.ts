/**
 * Opt-out route of the review invite email, served at REVIEW_INVITE_UNSUBSCRIBE_PATH.
 *
 * - POST is RFC 8058 one-click (the mail client's own button) and the confirm page's form. The
 *   token in the query string is the only credential. Always 200: an unknown token reveals nothing.
 * - GET changes nothing (link scanners prefetch it) and returns a page with a button that POSTs.
 */
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Good Luck</title></head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

export const optOutOfReviewInvites = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  await ctx.runMutation(internal.reviews.invites.optOutByToken, { token });
  return html("<h1>You are unsubscribed</h1><p>We will not email you to review your orders.</p>");
});

export const reviewInviteOptOutPage = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const action = `${url.pathname}?token=${encodeURIComponent(url.searchParams.get("token") ?? "")}`;
  return html(
    `<h1>Stop review emails?</h1><p>You will no longer get emails asking you to review your orders.</p><form method="POST" action="${action.replace(/"/g, "&quot;")}"><button type="submit" style="padding:12px 24px;font-size:16px">Unsubscribe</button></form>`
  );
});
