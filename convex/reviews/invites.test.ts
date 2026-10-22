/// <reference types="vite/client" />
/** Review invite (ADR 0028): scheduled once per delivered Order, skipped when pointless, one-click opt-out. */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import schema from "../schema";
import { generateUnsubscribeToken } from "../notifications/unsubscribe";
import { REVIEW_INVITE_DELAY_MS, REVIEW_INVITE_UNSUBSCRIBE_PATH } from "./model";
import { scheduleReviewInvite } from "./invites";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type TT = ReturnType<typeof t>;

async function seedOrder(
  tt: TT,
  over: Partial<Doc<"orders">> = {}
): Promise<Id<"orders">> {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber: "GL-7",
      clerkUserId: "u1",
      customerEmail: " Buyer@Example.com ",
      items: [{ variantId: "V1", quantity: 1, name: "Cap", price: 50, image: "/img.png", colorway: "Black", size: "M" }],
      currency: "USD",
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      paymentMethod: "stripe",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...over,
    })
  );
}

const schedule = (tt: TT, orderId: Id<"orders">, now = 1_000) =>
  tt.run(async (ctx) => {
    const order = (await ctx.db.get(orderId))!;
    await scheduleReviewInvite(ctx, order, now);
  });

const invites = (tt: TT) => tt.run(async (ctx) => ctx.db.query("review_invites").collect());

describe("scheduleReviewInvite", () => {
  it("delivered twice schedules one invite", async () => {
    const tt = t();
    const orderId = await seedOrder(tt);
    await schedule(tt, orderId);
    await schedule(tt, orderId, 5_000);
    const rows = await invites(tt);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderId, email: "buyer@example.com", sendAt: 1_000 + REVIEW_INVITE_DELAY_MS });
    expect(rows[0].jobId).toBeDefined();
    const jobs = await tt.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter((j) => j.name.endsWith("invites:sendReviewInvite"))).toHaveLength(1);
  });

  it("guest orders and orders without email get no invite", async () => {
    const tt = t();
    await schedule(tt, await seedOrder(tt, { clerkUserId: undefined }));
    await schedule(tt, await seedOrder(tt, { orderNumber: "GL-8", customerEmail: undefined }));
    await schedule(tt, await seedOrder(tt, { orderNumber: "GL-9", customerEmail: "nope" }));
    expect(await invites(tt)).toHaveLength(0);
  });
});

describe("sendReviewInvite skips", () => {
  async function scheduled(tt: TT, over: Partial<Doc<"orders">> = {}) {
    const orderId = await seedOrder(tt, over);
    await schedule(tt, orderId);
    const [row] = await invites(tt);
    return { orderId, inviteId: row._id };
  }
  const reasonOf = async (tt: TT, id: Id<"review_invites">) =>
    (await tt.run(async (ctx) => ctx.db.get(id)))!.skippedReason;

  it("send skips when every line is already reviewed", async () => {
    const tt = t();
    const { inviteId } = await scheduled(tt);
    await tt.run(async (ctx) =>
      ctx.db.insert("product_reviews", {
        variantId: "V1",
        clerkUserId: "u1",
        orderId: (await ctx.db.query("orders").first())!._id,
        rating: 5,
        locale: "en",
        displayName: "Buyer",
        status: "pending",
        createdAt: 1,
        updatedAt: 1,
      })
    );
    await tt.action(internal.reviews.invites.sendReviewInvite, { inviteId });
    expect(await reasonOf(tt, inviteId)).toBe("nothing_to_review");
  });

  it("send skips an opted-out email", async () => {
    const tt = t();
    const { inviteId } = await scheduled(tt);
    await tt.run(async (ctx) => ctx.db.insert("email_optouts", { email: "buyer@example.com", kind: "review_invite", createdAt: 1 }));
    await tt.action(internal.reviews.invites.sendReviewInvite, { inviteId });
    expect(await reasonOf(tt, inviteId)).toBe("opted_out");
  });

  it("send skips an order that is no longer delivered", async () => {
    const tt = t();
    const { orderId, inviteId } = await scheduled(tt);
    await tt.run(async (ctx) => ctx.db.patch(orderId, { cancelledAt: 2 }));
    await tt.action(internal.reviews.invites.sendReviewInvite, { inviteId });
    expect(await reasonOf(tt, inviteId)).toBe("order_not_delivered");
  });

  it("records a failed send without retrying or stamping sentAt", async () => {
    const tt = t();
    const { inviteId } = await scheduled(tt);
    // An address the email action refuses stands in for a provider failure (success: false).
    await tt.run(async (ctx) => ctx.db.patch(inviteId, { email: "no-at-sign" }));
    await tt.action(internal.reviews.invites.sendReviewInvite, { inviteId });
    const row = (await tt.run(async (ctx) => ctx.db.get(inviteId)))!;
    expect(row.skippedReason).toBe("send_failed");
    expect(row.sentAt).toBeUndefined();
  });

  it("send skips an invite already sent", async () => {
    const tt = t();
    const { inviteId } = await scheduled(tt);
    await tt.run(async (ctx) => ctx.db.patch(inviteId, { sentAt: 3 }));
    await tt.action(internal.reviews.invites.sendReviewInvite, { inviteId });
    expect(await reasonOf(tt, inviteId)).toBe("already_sent");
  });
});

describe("optOutByToken", () => {
  it("opt-out token is single-purpose and unknown tokens are ignored", async () => {
    const tt = t();
    const orderId = await seedOrder(tt);
    await schedule(tt, orderId);
    const [row] = await invites(tt);
    const optouts = () => tt.run(async (ctx) => ctx.db.query("email_optouts").collect());

    await tt.mutation(internal.reviews.invites.optOutByToken, { token: "short" });
    await tt.mutation(internal.reviews.invites.optOutByToken, { token: generateUnsubscribeToken() });
    expect(await optouts()).toHaveLength(0);

    await tt.mutation(internal.reviews.invites.optOutByToken, { token: row.unsubscribeToken });
    await tt.mutation(internal.reviews.invites.optOutByToken, { token: row.unsubscribeToken });
    expect(await optouts()).toMatchObject([{ email: "buyer@example.com", kind: "review_invite" }]);
  });
});

describe("opt-out HTTP route", () => {
  it("GET shows a confirm form and changes nothing; POST opts out", async () => {
    const tt = t();
    await schedule(tt, await seedOrder(tt));
    const [row] = await invites(tt);
    const url = `${REVIEW_INVITE_UNSUBSCRIBE_PATH}?token=${encodeURIComponent(row.unsubscribeToken)}`;
    const optouts = () => tt.run(async (ctx) => ctx.db.query("email_optouts").collect());

    const page = await tt.fetch(url, { method: "GET" });
    expect(page.status).toBe(200);
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(await page.text()).toMatch(/<form method="post"/i);
    expect(await optouts()).toHaveLength(0);

    const done = await tt.fetch(url, { method: "POST" });
    expect(done.status).toBe(200);
    expect(await optouts()).toMatchObject([{ email: "buyer@example.com", kind: "review_invite" }]);
  });
});

describe("invite through the delivery hooks", () => {
  const admin = (tt: TT) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });

  it("a manual desk move into delivered twice schedules exactly one invite", async () => {
    const tt = t();
    const orderId = await seedOrder(tt, { fulfillmentStatus: "in_transit" });
    const move = (fulfillmentStatus: "delivered" | "delivery_exception") =>
      admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId, fulfillmentStatus });
    await move("delivered");
    await move("delivery_exception");
    await move("delivered");
    const rows = await invites(tt);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderId, email: "buyer@example.com" });
  });

  it("carrier DELIVERED scans twice (with a failure between) schedule exactly one invite", async () => {
    const tt = t();
    const orderId = await seedOrder(tt, { fulfillmentStatus: "in_transit", carrier: "USPS", trackingNumber: "9400REVIEW" });
    const scan = (status: string) =>
      tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, { trackingNumber: "9400REVIEW", status });
    await scan("DELIVERED");
    await scan("FAILURE");
    await scan("DELIVERED");
    expect((await tt.run(async (ctx) => ctx.db.get(orderId)))?.fulfillmentStatus).toBe("delivered");
    const rows = await invites(tt);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderId });
  });
});
