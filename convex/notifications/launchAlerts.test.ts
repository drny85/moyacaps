/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import { isUnsubscribeToken } from "./unsubscribe";

const modules = import.meta.glob("/convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  aggregateTest.register(t, "dropAlertStats");
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
  return { t, admin };
}
type T = ReturnType<typeof setup>["t"];

async function teesComingSoon(admin: ReturnType<typeof setup>["admin"]) {
  await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "coming_soon" });
}

const signUp = (t: T, contact: string, channel: "email" | "whatsapp" = "email", category: "headwear" | "apparel" = "apparel") =>
  t.mutation(api.notifications.launchAlerts.subscribeToCategoryLaunch, { category, contact, channel, locale: "en" });

const alerts = (t: T) => t.run((ctx) => ctx.db.query("drop_alerts").take(50));
const sendJobs = async (t: T) =>
  (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(50))).filter((j) => j.name.endsWith("sendLaunchEmails"));

describe("alert sign-up abuse limits", () => {
  it("throttles signed-out sign-ups once the shared budget is spent", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    for (let i = 0; i < 30; i++) await signUp(t, `fan${i}@example.com`);
    await expect(signUp(t, "one-too-many@example.com")).rejects.toThrow(/Too many sign-ups/);
    // A signed-in fan has their own budget.
    await t
      .withIdentity({ subject: "user_fan" })
      .mutation(api.notifications.launchAlerts.subscribeToCategoryLaunch, { category: "apparel", contact: "me@example.com", channel: "email", locale: "en" });
  });

  it("drop alerts validate the contact and take the account from the token, not the client", async () => {
    const { t } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", {
        variantId: "drop-cap",
        isAvailable: true,
        nameEn: "Drop Cap",
        nameEs: "Gorra Drop",
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
    const subscribe = (tt: T | ReturnType<T["withIdentity"]>, contact: string, clerkUserId?: string) =>
      tt.mutation(api.catalog.drops.subscribeToDropAlert, { variantId: "drop-cap", contact, channel: "email", locale: "en", clerkUserId });

    await expect(subscribe(t, "not-an-email")).rejects.toThrow(/valid email/);
    await subscribe(t, "guest@example.com", "user_victim");
    await subscribe(t.withIdentity({ subject: "user_real" }), "Real@Example.com", "user_victim");
    const rows = await alerts(t);
    expect(rows.map((r) => [r.contact, r.clerkUserId])).toEqual([
      ["guest@example.com", undefined],
      ["real@example.com", "user_real"],
    ]);
  });
});

describe("Drop Radar subscriber counts", () => {
  async function seedDrop(t: T) {
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", {
        variantId: "radar-cap",
        isAvailable: true,
        nameEn: "Radar Cap",
        nameEs: "Gorra Radar",
        silhouette: "snapback",
        primaryHex: "#000000",
        secondaryHex: "#ffffff",
        image: "/img.png",
        stock: 5,
        priceUsd: 50,
        isFeatured: false,
        category: "headwear",
        isDrop: true,
        dropStatus: "scheduled",
        dropDate: Date.now() + 86_400_000,
      });
    });
  }
  const radarCount = async (t: T) =>
    (await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: Date.now() })).find((d) => d.variantId === "radar-cap")
      ?.subscribersCount;

  it("follow sign-ups and unsubscribes through the trigger, and ignore category waitlist rows", async () => {
    const { t, admin } = setup();
    await seedDrop(t);
    await teesComingSoon(admin);
    const subscribe = (contact: string) =>
      t.mutation(api.catalog.drops.subscribeToDropAlert, { variantId: "radar-cap", contact, channel: "email", locale: "en" });

    expect(await radarCount(t)).toBe(0);
    await subscribe("a@example.com");
    await subscribe("b@example.com");
    await subscribe("a@example.com"); // already subscribed: no new row
    await signUp(t, "waitlist@example.com");
    expect(await radarCount(t)).toBe(2);

    const [row] = (await alerts(t)).filter((a) => a.contact === "a@example.com");
    await t.mutation(api.notifications.launchAlerts.unsubscribe, { token: row.unsubscribeToken! });
    expect(await radarCount(t)).toBe(1);
  });

  it("the backfill counts rows written before the aggregate existed, once", async () => {
    const { t } = setup();
    await seedDrop(t);
    await t.run(async (ctx) => {
      for (const contact of ["x@example.com", "y@example.com", "z@example.com"]) {
        await ctx.db.insert("drop_alerts", { variantId: "radar-cap", contact, channel: "email", locale: "en", createdAt: 1 });
      }
      await ctx.db.insert("drop_alerts", {
        variantId: "radar-cap",
        contact: "gone@example.com",
        channel: "email",
        locale: "en",
        createdAt: 1,
        unsubscribedAt: 2,
      });
    });
    expect(await radarCount(t)).toBe(0);
    await t.mutation(internal.catalog.migrations.backfillDropAlertStats, {});
    await t.mutation(internal.catalog.migrations.backfillDropAlertStats, {});
    expect(await radarCount(t)).toBe(3);
  });
});

describe("subscribeToCategoryLaunch", () => {
  it("subscribes once per normalized contact", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const first = await signUp(t, " A@B.com ");
    const again = await signUp(t, "a@b.com");
    expect(first.alreadySubscribed).toBe(false);
    expect(again).toEqual({ success: true, alreadySubscribed: true, id: first.id });
    expect(await alerts(t)).toMatchObject([{ category: "apparel", contact: "a@b.com", channel: "email" }]);
  });

  it("refuses sign-ups unless the category is coming_soon", async () => {
    const { t, admin } = setup();
    await expect(signUp(t, "a@b.com")).rejects.toThrow("This category is not accepting sign-ups");
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "hidden" });
    await expect(signUp(t, "a@b.com")).rejects.toThrow("This category is not accepting sign-ups");
  });

  it("rejects an empty contact", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await expect(signUp(t, "   ")).rejects.toThrow();
  });
});

describe("launch emails", () => {
  it("going live claims only email rows of that category and queues them", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "headwear", status: "coming_soon" });
    await signUp(t, "tee@x.com");
    await signUp(t, "+15551234567", "whatsapp");
    await signUp(t, "cap@x.com", "email", "headwear");

    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "live" });
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });

    const notified = Object.fromEntries((await alerts(t)).map((a) => [a.contact, a.notifiedAt !== undefined]));
    expect(notified).toEqual({ "tee@x.com": true, "15551234567": false, "cap@x.com": false });
    const jobs = await sendJobs(t);
    expect(jobs).toHaveLength(1);
    expect((jobs[0].args[0] as { recipients: { contact: string }[] }).recipients).toMatchObject([{ contact: "tee@x.com" }]);
  });

  it("going live schedules the claim", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "apparel", status: "live" });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
    expect(scheduled.filter((j) => j.name.endsWith("claimLaunchEmails"))).toHaveLength(1);
  });

  it("second go-live sends nobody new", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await signUp(t, "tee@x.com");
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });
    expect(await sendJobs(t)).toHaveLength(1);
  });
});

describe("admin waitlist", () => {
  it("getCategoryWaitlistAdmin requires an Administrator", async () => {
    const { t } = setup();
    await expect(t.query(api.notifications.launchAlerts.getCategoryWaitlistAdmin, { category: "apparel" })).rejects.toThrow();
  });

  it("lists a category's subscribers newest first and marks one notified", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await signUp(t, "first@x.com");
    await signUp(t, "+15551234567", "whatsapp");
    const rows = await admin.query(api.notifications.launchAlerts.getCategoryWaitlistAdmin, { category: "apparel" });
    expect(rows.map((r) => r.contact)).toEqual(["15551234567", "first@x.com"]);

    await admin.mutation(api.notifications.launchAlerts.markAlertNotified, { id: rows[0]._id });
    const after = await admin.query(api.notifications.launchAlerts.getCategoryWaitlistAdmin, { category: "apparel" });
    expect(after[0].notifiedAt).toEqual(expect.any(Number));
  });

  it("product drop lists leave category sign-ups out", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await signUp(t, "a@b.com");
    expect(await admin.query(api.catalog.drops.getDropSubscribersList, {})).toEqual([]);
    expect(await admin.query(api.catalog.drops.getDropSubscribers, {})).toEqual([]);
  });
});

describe("sign-up input limits", () => {
  it("rejects malformed emails and oversized fields", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await expect(signUp(t, "not-an-email")).rejects.toThrow("Enter a valid email");
    await expect(signUp(t, `${"a".repeat(250)}@x.com`)).rejects.toThrow("Enter a valid email");
    await expect(
      t.mutation(api.notifications.launchAlerts.subscribeToCategoryLaunch, {
        category: "apparel", contact: "a@b.com", channel: "email", locale: "en", name: "n".repeat(81),
      })
    ).rejects.toThrow("Name is too long");
  });

  it("stores WhatsApp numbers as digits so formatting variants are one sign-up", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const first = await signUp(t, "+1 (555) 123-4567", "whatsapp");
    const again = await signUp(t, "15551234567", "whatsapp");
    expect(again).toEqual({ success: true, alreadySubscribed: true, id: first.id });
    await expect(signUp(t, "12", "whatsapp")).rejects.toThrow("Enter a valid WhatsApp number");
  });

  it("takes the Clerk user from the session, never from the caller", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await t.withIdentity({ subject: "user_real" }).mutation(api.notifications.launchAlerts.subscribeToCategoryLaunch, {
      category: "apparel", contact: "a@b.com", channel: "email", locale: "en",
    });
    expect((await alerts(t))[0].clerkUserId).toBe("user_real");
  });
});

type Recipient = { contact: string; unsubscribeToken: string };
const sentTo = async (t: T) =>
  (await sendJobs(t)).flatMap((j) => (j.args[0] as { recipients: Recipient[] }).recipients);
const tokenOf = async (t: T, id: Id<"drop_alerts">) => (await t.run((ctx) => ctx.db.get("drop_alerts", id)))!.unsubscribeToken!;
const unsubscribe = (t: T, token: string) => t.mutation(api.notifications.launchAlerts.unsubscribe, { token });

describe("unsubscribe", () => {
  it("every new sign-up gets its own token", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await signUp(t, "a@x.com");
    await signUp(t, "b@x.com");
    const tokens = (await alerts(t)).map((a) => a.unsubscribeToken);
    expect(tokens.every(isUnsubscribeToken)).toBe(true);
    expect(new Set(tokens).size).toBe(2);
  });

  it("opts out once, idempotently, and returns no PII", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "a@x.com");
    const token = await tokenOf(t, id);

    expect(await unsubscribe(t, token)).toEqual({ status: "unsubscribed" });
    const at = (await alerts(t))[0].unsubscribedAt;
    expect(at).toEqual(expect.any(Number));
    expect(await unsubscribe(t, token)).toEqual({ status: "already_unsubscribed" });
    expect((await alerts(t))[0].unsubscribedAt).toBe(at);
  });

  it("rejects malformed and unknown tokens without touching anyone", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await signUp(t, "a@x.com");
    expect(await unsubscribe(t, "")).toEqual({ status: "not_found" });
    expect(await unsubscribe(t, "not-a-token")).toEqual({ status: "not_found" });
    expect(await unsubscribe(t, "A".repeat(43))).toEqual({ status: "not_found" });
    expect((await alerts(t))[0].unsubscribedAt).toBeUndefined();
  });

  it("an unsubscribed reader gets no launch email; others still do", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "gone@x.com");
    await signUp(t, "stays@x.com");
    await unsubscribe(t, await tokenOf(t, id));

    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });
    expect((await sentTo(t)).map((r) => r.contact)).toEqual(["stays@x.com"]);
    const gone = (await alerts(t)).find((a) => a.contact === "gone@x.com")!;
    expect(gone.notifiedAt).toBeUndefined();
  });

  it("a waitlist where everyone unsubscribed sends nothing and does not loop", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "gone@x.com");
    await unsubscribe(t, await tokenOf(t, id));
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
    expect(jobs.filter((j) => /sendLaunchEmails|claimLaunchEmails/.test(j.name))).toEqual([]);
  });

  it("covers the contact's other sign-ups on the same channel, nobody else's", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    await admin.mutation(api.settings.functions.setCategoryLaunch, { category: "headwear", status: "coming_soon" });
    const { id } = await signUp(t, "a@x.com");
    await signUp(t, "a@x.com", "email", "headwear");
    await signUp(t, "b@x.com", "email", "headwear");
    await unsubscribe(t, await tokenOf(t, id));

    const out = (await alerts(t)).map((a) => [a.contact, a.category, a.unsubscribedAt !== undefined]);
    expect(out).toEqual([
      ["a@x.com", "apparel", true],
      ["a@x.com", "headwear", true],
      ["b@x.com", "headwear", false],
    ]);
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "headwear" });
    expect((await sentTo(t)).map((r) => r.contact)).toEqual(["b@x.com"]);
  });

  it("the launch send carries each reader's token, minting one for a legacy row", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "new@x.com");
    await t.run((ctx) =>
      ctx.db.insert("drop_alerts", { category: "apparel", contact: "old@x.com", channel: "email", locale: "es", createdAt: 1 })
    );
    await t.mutation(internal.notifications.launchAlerts.claimLaunchEmails, { category: "apparel" });

    const byContact = Object.fromEntries((await sentTo(t)).map((r) => [r.contact, r.unsubscribeToken]));
    expect(byContact["new@x.com"]).toBe(await tokenOf(t, id));
    expect(isUnsubscribeToken(byContact["old@x.com"])).toBe(true);
    const old = (await alerts(t)).find((a) => a.contact === "old@x.com")!;
    expect(old.unsubscribeToken).toBe(byContact["old@x.com"]);
  });
});

describe("backfillUnsubscribeTokens", () => {
  it("gives every row a token in batches, keeps existing ones, and is idempotent", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "has@x.com");
    const kept = await tokenOf(t, id);
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) {
        await ctx.db.insert("drop_alerts", { variantId: "V1", contact: `p${i}@x.com`, channel: "email", locale: "en", createdAt: i });
      }
    });

    const first = await t.mutation(internal.notifications.launchAlerts.backfillUnsubscribeTokens, {});
    expect(first).toEqual({ patched: 199, isDone: false });
    await t.finishAllScheduledFunctions(() => {});

    const rows = await t.run((ctx) => ctx.db.query("drop_alerts").take(300));
    expect(rows).toHaveLength(251);
    expect(rows.every((r) => isUnsubscribeToken(r.unsubscribeToken))).toBe(true);
    expect(new Set(rows.map((r) => r.unsubscribeToken)).size).toBe(251);
    expect(rows.find((r) => r._id === id)!.unsubscribeToken).toBe(kept);

    expect(await t.mutation(internal.notifications.launchAlerts.backfillUnsubscribeTokens, {})).toEqual({ patched: 0, isDone: false });
    await t.finishAllScheduledFunctions(() => {});
    expect((await t.run((ctx) => ctx.db.query("drop_alerts").take(300))).map((r) => r.unsubscribeToken)).toEqual(
      rows.map((r) => r.unsubscribeToken)
    );
  });
});

describe("one-click unsubscribe HTTP route", () => {
  it("POST (RFC 8058) opts the reader out", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "a@x.com");
    const token = await tokenOf(t, id);

    const res = await t.fetch(`/unsubscribe?token=${token}&locale=en`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(res.status).toBe(200);
    expect((await alerts(t))[0].unsubscribedAt).toEqual(expect.any(Number));
    expect((await t.fetch(`/unsubscribe?token=${token}`, { method: "POST" })).status).toBe(200);
  });

  it("POST with an unknown token is a 404", async () => {
    const { t } = setup();
    expect((await t.fetch(`/unsubscribe?token=${"A".repeat(43)}`, { method: "POST" })).status).toBe(404);
    expect((await t.fetch("/unsubscribe", { method: "POST" })).status).toBe(404);
  });

  it("GET changes nothing and redirects to the page in the reader's language", async () => {
    const { t, admin } = setup();
    await teesComingSoon(admin);
    const { id } = await signUp(t, "a@x.com");
    const token = await tokenOf(t, id);

    const res = await t.fetch(`/unsubscribe?token=${token}&locale=es`, { method: "GET", redirect: "manual" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toMatch(new RegExp(`/es/unsubscribe\\?token=${token}$`));
    expect((await alerts(t))[0].unsubscribedAt).toBeUndefined();
  });
});
