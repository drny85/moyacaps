/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
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
    expect(notified).toEqual({ "tee@x.com": true, "+15551234567": false, "cap@x.com": false });
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
    expect(rows.map((r) => r.contact)).toEqual(["+15551234567", "first@x.com"]);

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
