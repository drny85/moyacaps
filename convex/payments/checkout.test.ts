/// <reference types="vite/client" />
/**
 * createCheckoutSession end to end through Convex, with the Stripe SDK stubbed: the held
 * Order's owner comes from the auth token only, never from the client-sent `clerkUserId`.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const stripe = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
}));

vi.mock("./stripeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stripeClient")>()),
  getStripe: () => ({ checkout: { sessions: { create: stripe.sessionsCreate } } }),
  upsertStripeCustomer: async () => "cus_test",
}));

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const VARIANT = "cap-owner-test";

async function seedVariant(tt: T) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId: VARIANT,
      isAvailable: true,
      nameEn: "Cap",
      nameEs: "Gorra",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock: 5,
      priceUsd: 50,
      isFeatured: false,
      category: "headwear",
    });
  });
}

const checkoutArgs = (extra: { clerkUserId?: string; customerEmail?: string } = {}) => ({
  items: [{ variantId: VARIANT, quantity: 1 }],
  currency: "USD",
  locale: "en",
  origin: "https://goodluckcaps.com",
  ...extra,
});

async function heldOrderOwner(tt: T, orderNumber: string) {
  const order = await tt.run(async (ctx) =>
    ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .unique()
  );
  expect(order).not.toBeNull();
  return order!.clerkUserId;
}

describe("createCheckoutSession owner", () => {
  beforeEach(() => {
    stripe.sessionsCreate.mockReset();
    stripe.sessionsCreate.mockImplementation(async () => ({
      id: `cs_test_${stripe.sessionsCreate.mock.calls.length}`,
      url: "https://checkout.stripe.com/test",
    }));
  });

  it("ignores a client-sent clerkUserId from a guest: the Order stays a guest Order", async () => {
    const tt = t();
    await seedVariant(tt);

    const { orderNumber } = await tt.action(
      api.payments.checkout.createCheckoutSession,
      checkoutArgs({ clerkUserId: "user_victim", customerEmail: "guest@example.com" })
    );

    expect(await heldOrderOwner(tt, orderNumber)).toBeUndefined();
    const [params] = stripe.sessionsCreate.mock.calls[0];
    expect(params.metadata.clerkUserId).toBe("");
    expect(params.payment_intent_data.metadata.clerkUserId).toBe("");
  });

  it("uses the auth token's subject, not a different client-sent clerkUserId", async () => {
    const tt = t();
    await seedVariant(tt);

    const { orderNumber } = await tt
      .withIdentity({ subject: "user_buyer" })
      .action(api.payments.checkout.createCheckoutSession, checkoutArgs({ clerkUserId: "user_victim" }));

    expect(await heldOrderOwner(tt, orderNumber)).toBe("user_buyer");
    expect(stripe.sessionsCreate.mock.calls[0][0].metadata.clerkUserId).toBe("user_buyer");
  });
});
