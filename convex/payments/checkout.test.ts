/// <reference types="vite/client" />
/**
 * createCheckoutSession end to end through Convex, with the Stripe SDK stubbed: the held
 * Order's owner comes from the auth token only, never from the client-sent `clerkUserId`.
 */
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import aggregateTest from "@convex-dev/aggregate/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { setCapStock } from "../catalog/inventory";
import { issueCheckoutPass } from "../lib/checkoutPass";

const stripe = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
  sessionsExpire: vi.fn(),
}));

vi.mock("./stripeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stripeClient")>()),
  getStripe: () => ({
    checkout: {
      sessions: { create: stripe.sessionsCreate, retrieve: stripe.sessionsRetrieve, expire: stripe.sessionsExpire },
    },
  }),
  upsertStripeCustomer: async () => "cus_test",
}));

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => {
  const tt = convexTest(schema, modules);
  rateLimiterTest.register(tt);
  aggregateTest.register(tt, "orderStats");
  return tt;
};
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

const checkoutArgs = (extra: { clerkUserId?: string; customerEmail?: string; checkoutPass?: string } = {}) => ({
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

describe("createCheckoutSession redirect URLs", () => {
  beforeEach(() => {
    stripe.sessionsCreate.mockReset();
    stripe.sessionsCreate.mockImplementation(async () => ({ id: "cs_test_redirect", url: "https://checkout.stripe.com/test" }));
  });

  it("sends Stripe back to our site, not to a browser-sent foreign origin or locale", async () => {
    const tt = t();
    await seedVariant(tt);
    await tt.action(api.payments.checkout.createCheckoutSession, {
      ...checkoutArgs(),
      origin: "https://evil.example",
      locale: "x/../../evil",
    });
    const [params] = stripe.sessionsCreate.mock.calls[0];
    expect(params.success_url).toMatch(/^https:\/\/goodluckcaps\.com\/en\/checkout\/success\?/);
    expect(params.cancel_url).toBe("https://goodluckcaps.com/en/checkout?canceled=1");
  });
});

describe("createCheckoutSession rate limit", () => {
  beforeEach(() => {
    stripe.sessionsCreate.mockReset();
    stripe.sessionsCreate.mockImplementation(async () => ({
      id: `cs_test_${stripe.sessionsCreate.mock.calls.length}`,
      url: "https://checkout.stripe.com/test",
    }));
  });

  it("stops one buyer after 10 Pay clicks without placing another hold", async () => {
    const tt = t();
    await seedVariant(tt);
    const buyer = tt.withIdentity({ subject: "user_spammer" });
    const pay = () => buyer.action(api.payments.checkout.createCheckoutSession, checkoutArgs());

    // Each click holds one unit; release them so stock never runs out first.
    for (let i = 0; i < 10; i++) {
      await pay();
      await tt.run(async (ctx) => {
        const variant = (await ctx.db.query("variants").first())!;
        await setCapStock(ctx, variant.variantId, 5);
      });
    }
    await expect(pay()).rejects.toThrow(/Too many checkout attempts/);
    expect(stripe.sessionsCreate).toHaveBeenCalledTimes(10);

    // Another buyer is unaffected.
    await tt.withIdentity({ subject: "user_other" }).action(api.payments.checkout.createCheckoutSession, checkoutArgs());
    expect(stripe.sessionsCreate).toHaveBeenCalledTimes(11);
  });
});

const PASS_SECRET = "test-checkout-pass-secret";

/** Calls `call` until it throws a rate-limit error (or `max` calls); returns how many succeeded. */
async function callsUntilLimited(max: number, call: () => Promise<unknown>) {
  for (let i = 0; i < max; i++) {
    try {
      await call();
    } catch (err) {
      expect(String(err)).toMatch(/Too many checkout attempts/);
      return i;
    }
  }
  throw new Error(`not limited after ${max} calls`);
}

/** Pay once, then put the held unit back so stock never runs out before the limit does. */
async function payAndRestock(tt: T, pay: () => Promise<unknown>) {
  await pay();
  await tt.run(async (ctx) => {
    const variant = (await ctx.db.query("variants").first())!;
    await setCapStock(ctx, variant.variantId, 5);
  });
}

describe("createCheckoutSession guest rate limit (Checkout Pass, M2)", () => {
  beforeEach(() => {
    // Frozen clock: buckets do not refill while a test drains them.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("CHECKOUT_PASS_SECRET", PASS_SECRET);
    stripe.sessionsCreate.mockReset();
    stripe.sessionsCreate.mockImplementation(async () => ({
      id: `cs_test_${stripe.sessionsCreate.mock.calls.length}`,
      url: "https://checkout.stripe.com/test",
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("limits one guest IP on its own: other IPs and pass-less guests still check out", async () => {
    const tt = t();
    await seedVariant(tt);
    const passFor = (ip: string) => issueCheckoutPass(PASS_SECRET, ip, Date.now());
    const payFrom = async (ip: string) =>
      tt.action(api.payments.checkout.createCheckoutSession, checkoutArgs({ checkoutPass: await passFor(ip) }));

    for (let i = 0; i < 10; i++) await payAndRestock(tt, () => payFrom("203.0.113.7"));
    await expect(payFrom("203.0.113.7")).rejects.toThrow(/Too many checkout attempts/);
    expect(stripe.sessionsCreate).toHaveBeenCalledTimes(10);

    await payFrom("198.51.100.1");
    await tt.action(api.payments.checkout.createCheckoutSession, checkoutArgs());
    expect(stripe.sessionsCreate).toHaveBeenCalledTimes(12);
  });

  it("puts a guest with a forged pass in the shared bucket, not a fresh per-IP one", async () => {
    const tt = t();
    await seedVariant(tt);
    const forged = await issueCheckoutPass("not-the-secret", "203.0.113.7", Date.now());
    // The shared bucket holds 60 (sharded, so it can run dry a little early); a forged pass
    // gets no more than a guest without one, where a per-IP bucket would stop it at 10.
    const accepted = await callsUntilLimited(80, () =>
      payAndRestock(tt, () => tt.action(api.payments.checkout.createCheckoutSession, checkoutArgs({ checkoutPass: forged })))
    );
    expect(accepted).toBeGreaterThan(10);
    expect(accepted).toBeLessThanOrEqual(60);
    // A real pass is unaffected by the drained shared bucket.
    await tt.action(
      api.payments.checkout.createCheckoutSession,
      checkoutArgs({ checkoutPass: await issueCheckoutPass(PASS_SECRET, "203.0.113.7", Date.now()) })
    );
  });
});

describe("public Stripe session lookups (M1)", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    stripe.sessionsCreate.mockReset();
    stripe.sessionsCreate.mockImplementation(async () => ({
      id: `cs_test_${stripe.sessionsCreate.mock.calls.length}`,
      url: "https://checkout.stripe.com/test",
    }));
    stripe.sessionsRetrieve.mockReset();
    stripe.sessionsRetrieve.mockImplementation(async (id: string) => ({ id, status: "open", metadata: {} }));
    stripe.sessionsExpire.mockReset();
    stripe.sessionsExpire.mockImplementation(async (id: string) => ({ id, status: "expired" }));
  });

  it("sync never calls Stripe for an id that is not a Checkout Session", async () => {
    const tt = t();
    expect(await tt.action(api.payments.webhook.syncCheckoutSession, { sessionId: "pi_123" })).toEqual({
      success: false,
      status: "unrecognized_session",
    });
    expect(stripe.sessionsRetrieve).not.toHaveBeenCalled();
  });

  it("sync looks one session up at most 5 times a minute", async () => {
    const tt = t();
    for (let i = 0; i < 5; i++) {
      await tt.action(api.payments.webhook.syncCheckoutSession, { sessionId: "cs_test_hammered" });
    }
    expect(await tt.action(api.payments.webhook.syncCheckoutSession, { sessionId: "cs_test_hammered" })).toEqual({
      success: false,
      status: "rate_limited",
    });
    expect(stripe.sessionsRetrieve).toHaveBeenCalledTimes(5);
  });

  it("caps sync across sessions, while the back link still releases a real hold", async () => {
    const tt = t();
    await seedVariant(tt);
    const { sessionId } = await tt.action(api.payments.checkout.createCheckoutSession, checkoutArgs());

    // 120 a minute across every session (sharded, so it can run dry a little early).
    let looked = 0;
    while (looked < 130) {
      const result = await tt.action(api.payments.webhook.syncCheckoutSession, { sessionId: `cs_test_random_${looked}` });
      if (result.status === "rate_limited") break;
      looked++;
    }
    expect(looked).toBeGreaterThan(90);
    expect(looked).toBeLessThanOrEqual(120);
    expect(stripe.sessionsRetrieve).toHaveBeenCalledTimes(looked);

    expect(await tt.action(api.payments.checkout.abandonCheckoutSession, { sessionId })).toEqual({ released: true });
  });

  it("abandon looks one session up at most 5 times a minute", async () => {
    const tt = t();
    await seedVariant(tt);
    const { sessionId } = await tt.action(api.payments.checkout.createCheckoutSession, checkoutArgs());
    // Paid elsewhere: Stripe reports it complete, so nothing is released and the order stays held.
    stripe.sessionsRetrieve.mockImplementation(async (id: string) => ({ id, status: "complete", metadata: {} }));
    for (let i = 0; i < 6; i++) {
      await tt.action(api.payments.checkout.abandonCheckoutSession, { sessionId });
    }
    expect(stripe.sessionsRetrieve).toHaveBeenCalledTimes(5);
  });
});
