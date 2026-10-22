/// <reference types="vite/client" />
/**
 * ADR 0026 end to end through Convex: a signed-in Customer whose email Clerk has verified
 * takes the guest Orders placed with that email, from either sync path (sign-in JIT sync or
 * the signed Clerk webhook). Unverified emails, owned Orders and other emails are untouched.
 */
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
// orderStats: every order write updates the dashboard aggregate (analytics/orderStats.ts).
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const ANA = "user_ana";

async function seedOrder(
  tt: T,
  orderNumber: string,
  opts: { customerEmail?: string; clerkUserId?: string } = {}
): Promise<Id<"orders">> {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber,
      customerEmail: opts.customerEmail,
      clerkUserId: opts.clerkUserId,
      items: [{ variantId: "V1", name: "Cap", quantity: 1, price: 50, image: "/img.png" }],
      currency: "USD",
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
}

async function ownerOf(tt: T, orderId: Id<"orders">) {
  return (await tt.run(async (ctx) => ctx.db.get(orderId)))?.clerkUserId;
}

async function seedFixture(tt: T) {
  return {
    guest: await seedOrder(tt, "GL-GUEST-1", { customerEmail: "ana@example.com" }),
    guestTwo: await seedOrder(tt, "GL-GUEST-2", { customerEmail: "ana@example.com" }),
    owned: await seedOrder(tt, "GL-OWNED-1", { customerEmail: "ana@example.com", clerkUserId: "user_other" }),
    otherEmail: await seedOrder(tt, "GL-OTHER-1", { customerEmail: "someone@example.com" }),
  };
}

describe("guest Order claims on sign-in sync", () => {
  it("a verified email claims its guest Orders, and they show in the account history", async () => {
    const tt = t();
    const orders = await seedFixture(tt);
    const ana = tt.withIdentity({ subject: ANA, email: "Ana@Example.com", emailVerified: true });

    await ana.mutation(api.users.functions.syncCurrentUser, {});

    expect(await ownerOf(tt, orders.guest)).toBe(ANA);
    expect(await ownerOf(tt, orders.guestTwo)).toBe(ANA);
    expect(await ownerOf(tt, orders.owned)).toBe("user_other");
    expect(await ownerOf(tt, orders.otherEmail)).toBeUndefined();

    const history = await ana.query(api.orders.functions.getOrdersByClerkId, { clerkUserId: ANA });
    expect(history.map((o) => o.orderNumber).sort()).toEqual(["GL-GUEST-1", "GL-GUEST-2"]);
  });

  it("an unverified or unstated email claims nothing", async () => {
    for (const emailVerified of [false, undefined]) {
      const tt = t();
      const orders = await seedFixture(tt);

      await tt
        .withIdentity({ subject: ANA, email: "ana@example.com", emailVerified })
        .mutation(api.users.functions.syncCurrentUser, {});

      expect(await ownerOf(tt, orders.guest)).toBeUndefined();
      expect(await ownerOf(tt, orders.guestTwo)).toBeUndefined();
    }
  });
});

describe("guest Order claims from the Clerk webhook", () => {
  const upsert = (emailVerified?: boolean) => ({
    clerkId: ANA,
    email: "ana@example.com",
    role: "customer" as const,
    ...(emailVerified !== undefined && { emailVerified }),
  });

  it("a verified primary email claims its guest Orders", async () => {
    const tt = t();
    const orders = await seedFixture(tt);

    await tt.mutation(internal.users.functions.upsertUser, upsert(true));

    expect(await ownerOf(tt, orders.guest)).toBe(ANA);
    expect(await ownerOf(tt, orders.owned)).toBe("user_other");
    expect(await ownerOf(tt, orders.otherEmail)).toBeUndefined();
  });

  it("an unverified primary email claims nothing", async () => {
    const tt = t();
    const orders = await seedFixture(tt);

    await tt.mutation(internal.users.functions.upsertUser, upsert(false));
    await tt.mutation(internal.users.functions.upsertUser, upsert());

    expect(await ownerOf(tt, orders.guest)).toBeUndefined();
  });
});

describe("normalizeOrderEmails backfill", () => {
  it("lowercases and trims stored emails so a claim matches them", async () => {
    const tt = t();
    const mixed = await seedOrder(tt, "GL-MIXED-1", { customerEmail: " Ana@Example.COM " });
    const none = await seedOrder(tt, "GL-NONE-1");

    const first = await tt.mutation(internal.orders.guestClaim.normalizeOrderEmails, {});
    expect(first).toMatchObject({ patched: 1, isDone: true });
    const again = await tt.mutation(internal.orders.guestClaim.normalizeOrderEmails, {});
    expect(again.patched).toBe(0);

    const emailOf = async (id: Id<"orders">) => (await tt.run(async (ctx) => ctx.db.get(id)))?.customerEmail;
    expect(await emailOf(mixed)).toBe("ana@example.com");
    expect(await emailOf(none)).toBeUndefined();

    await tt.withIdentity({ subject: ANA, email: "ana@example.com", emailVerified: true }).mutation(
      api.users.functions.syncCurrentUser,
      {}
    );
    expect(await ownerOf(tt, mixed)).toBe(ANA);
  });
});
