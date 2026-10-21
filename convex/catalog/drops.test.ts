/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { isPurchaseBlockedByDrop } from "./model";
import { SCHEDULER_ACTOR } from "./drops";
import { RELEASE_BACKFILL_ACTOR } from "./migrations";

const modules = import.meta.glob("/convex/**/*.ts");

const cap = {
  variantId: "oro-negro",
  nameEn: "Gold / Black",
  nameEs: "Oro / Negro",
  category: "headwear" as const,
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#d4af37",
  priceUsd: 45,
  stock: 10,
  isFeatured: false,
};

// Near enough that the test runtime can hold a timer for it (far dates overflow setTimeout).
const DROP_DATE = Date.now() + 86_400_000;
const LATER = DROP_DATE + 3_600_000;

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  const row = () =>
    t.run((ctx) =>
      ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", cap.variantId))
        .unique()
    );
  const job = async () => {
    const variant = await row();
    return variant?.dropReleaseJobId === undefined ? null : await t.run((ctx) => ctx.db.system.get("_scheduled_functions", variant.dropReleaseJobId!));
  };
  const jobState = (id: string) => t.run((ctx) => ctx.db.system.get("_scheduled_functions", id as never)).then((j) => j?.state.kind);
  const history = () => admin.query(api.catalog.history.getVariantHistory, { variantId: cap.variantId });
  const schedule = async (dropDate = DROP_DATE) => {
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate, dropBadgeTextEn: "Gold Rush", dropBadgeTextEs: "Fiebre del Oro" });
  };
  return { t, admin, row, job, jobState, history, schedule };
}

describe("scheduling a drop", () => {
  it("creates a release job at dropDate and records its id on the variant", async () => {
    const { schedule, row, job } = setup();
    await schedule();
    const variant = await row();
    expect(variant).toMatchObject({ isDrop: true, dropStatus: "scheduled", dropDate: DROP_DATE });
    expect(variant!.dropReleaseJobId).toBeDefined();
    const scheduled = await job();
    expect(scheduled).toMatchObject({ scheduledTime: DROP_DATE, state: { kind: "pending" }, args: [{ variantId: cap.variantId, dropDate: DROP_DATE }] });
    expect(scheduled!.name).toContain("releaseScheduledDrop");
  });

  it("keeps the job id out of the product history", async () => {
    const { schedule, history } = setup();
    await schedule();
    const [event] = await history();
    expect(event.type).toBe("drop_changed");
    expect(event.changes ?? "").not.toContain("dropReleaseJobId");
  });

  it("postponing cancels the old job and schedules a new one", async () => {
    const { schedule, admin, row, job, jobState } = setup();
    await schedule();
    const oldJobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.postponeDrop, { variantId: cap.variantId, newDropDate: LATER });
    expect(await jobState(oldJobId)).toBe("canceled");
    const next = await job();
    expect(next).toMatchObject({ scheduledTime: LATER, state: { kind: "pending" } });
    expect((await row())!.dropReleaseJobId).not.toBe(oldJobId);
  });

  it("rescheduling with scheduleDrop replaces the job", async () => {
    const { schedule, admin, row, jobState } = setup();
    await schedule();
    const oldJobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: cap.variantId, dropDate: LATER });
    expect(await jobState(oldJobId)).toBe("canceled");
    expect((await row())!.dropReleaseJobId).not.toBe(oldJobId);
  });

  it("updateVariantDropStatus schedules a job when it schedules a drop and cancels it otherwise", async () => {
    const { admin, row, job, jobState } = setup();
    await admin.mutation(api.catalog.admin.createVariant, cap);
    await admin.mutation(api.catalog.drops.updateVariantDropStatus, { variantId: cap.variantId, isDrop: true, dropDate: DROP_DATE });
    expect(await job()).toMatchObject({ scheduledTime: DROP_DATE, state: { kind: "pending" } });
    const jobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.updateVariantDropStatus, { variantId: cap.variantId, isDrop: false });
    expect(await jobState(jobId)).toBe("canceled");
    expect((await row())!.dropReleaseJobId).toBeUndefined();
  });
});

describe("cancelling, deleting and releasing by hand", () => {
  it("cancelDrop cancels the job", async () => {
    const { schedule, admin, row, jobState } = setup();
    await schedule();
    const jobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.cancelDrop, { variantId: cap.variantId });
    expect(await jobState(jobId)).toBe("canceled");
    expect(await row()).toMatchObject({ isDrop: false, dropStatus: "archived" });
    expect((await row())!.dropReleaseJobId).toBeUndefined();
  });

  it("deleteDrop cancels the job", async () => {
    const { schedule, admin, row, jobState } = setup();
    await schedule();
    const jobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.deleteDrop, { variantId: cap.variantId });
    expect(await jobState(jobId)).toBe("canceled");
    expect((await row())!.dropReleaseJobId).toBeUndefined();
  });

  it("releaseDropNow cancels the job and goes live with the released badge by default", async () => {
    const { schedule, admin, row, jobState } = setup();
    await schedule();
    const jobId = (await row())!.dropReleaseJobId!;
    await admin.mutation(api.catalog.drops.releaseDropNow, { variantId: cap.variantId });
    expect(await jobState(jobId)).toBe("canceled");
    const variant = await row();
    expect(variant).toMatchObject({ dropStatus: "live", dropBadgeTextEn: "Released Drop", dropBadgeTextEs: "Drop Lanzado" });
    expect(variant!.dropReleaseJobId).toBeUndefined();
    expect(isPurchaseBlockedByDrop(variant!, Date.now())).toBe(false);
  });

  it("purging the product cancels the job", async () => {
    const { schedule, t, row, jobState } = setup();
    await schedule();
    const jobId = (await row())!.dropReleaseJobId!;
    await t.mutation(internal.catalog.admin.purgeVariant, { variantId: cap.variantId });
    expect(await jobState(jobId)).toBe("canceled");
  });
});

describe("releaseScheduledDrop", () => {
  it("flips the drop to live, keeps the badge, unblocks purchase and audits the scheduler as actor", async () => {
    const { schedule, t, row, history } = setup();
    await schedule();
    const before = await row();
    expect(isPurchaseBlockedByDrop(before!, DROP_DATE - 1)).toBe(true);

    expect(await t.mutation(internal.catalog.drops.releaseScheduledDrop, { variantId: cap.variantId, dropDate: DROP_DATE })).toEqual({ released: true });

    const after = await row();
    expect(after).toMatchObject({ isDrop: true, dropStatus: "live", dropBadgeTextEn: "Gold Rush", dropBadgeTextEs: "Fiebre del Oro" });
    expect(after!.dropReleaseJobId).toBeUndefined();
    expect(after!.dropDate!).toBeLessThan(Date.now());
    expect(isPurchaseBlockedByDrop(after!, Date.now())).toBe(false);
    expect((await history())[0]).toMatchObject({ type: "drop_changed", actor: SCHEDULER_ACTOR });
  });

  it("runs when the scheduler fires at dropDate", async () => {
    vi.useFakeTimers();
    try {
      const { schedule, t, row } = setup();
      await schedule();
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await row()).toMatchObject({ dropStatus: "live" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("is a no-op for a stale date after a reschedule", async () => {
    const { schedule, admin, t, row, history } = setup();
    await schedule();
    await admin.mutation(api.catalog.drops.postponeDrop, { variantId: cap.variantId, newDropDate: LATER });
    const events = (await history()).length;
    expect(await t.mutation(internal.catalog.drops.releaseScheduledDrop, { variantId: cap.variantId, dropDate: DROP_DATE })).toEqual({ released: false });
    expect(await row()).toMatchObject({ dropStatus: "scheduled", dropDate: LATER });
    expect(await history()).toHaveLength(events);
  });

  it("is a no-op once the drop was cancelled", async () => {
    const { schedule, admin, t, row } = setup();
    await schedule();
    await admin.mutation(api.catalog.drops.cancelDrop, { variantId: cap.variantId });
    expect(await t.mutation(internal.catalog.drops.releaseScheduledDrop, { variantId: cap.variantId, dropDate: DROP_DATE })).toEqual({ released: false });
    expect(await row()).toMatchObject({ isDrop: false, dropStatus: "archived" });
  });

  it("is a no-op for a product that no longer exists", async () => {
    const { t } = setup();
    expect(await t.mutation(internal.catalog.drops.releaseScheduledDrop, { variantId: "ghost", dropDate: DROP_DATE })).toEqual({ released: false });
  });
});

describe("releaseOverdueDrops", () => {
  const overdue = { ...cap, isDrop: true, dropStatus: "scheduled" as const, dropDate: 1_000, dropBadgeTextEn: "Old", dropBadgeTextEs: "Viejo" };

  it("dry run only reports the overdue scheduled drops", async () => {
    const { t, row } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...overdue, image: "" });
      await ctx.db.insert("variants", { ...overdue, image: "", variantId: "future", dropDate: DROP_DATE });
      await ctx.db.insert("variants", { ...overdue, image: "", variantId: "live", dropStatus: "live" });
      await ctx.db.insert("variants", { ...cap, image: "", variantId: "plain" });
    });
    expect(await t.mutation(internal.catalog.migrations.releaseOverdueDrops, { dryRun: true })).toEqual({
      dryRun: true,
      count: 1,
      variantIds: [cap.variantId],
      isDone: true,
    });
    expect(await row()).toMatchObject({ dropStatus: "scheduled" });
  });

  it("releases them with the badge kept and audits the backfill as actor, then has nothing left", async () => {
    const { t, admin, row } = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("variants", { ...overdue, image: "" });
      await ctx.db.insert("variants", { ...overdue, image: "", variantId: "future", dropDate: DROP_DATE });
    });
    expect(await t.mutation(internal.catalog.migrations.releaseOverdueDrops, {})).toMatchObject({ dryRun: false, count: 1, variantIds: [cap.variantId] });
    const released = await row();
    expect(released).toMatchObject({ dropStatus: "live", dropBadgeTextEn: "Old", dropBadgeTextEs: "Viejo" });
    expect(isPurchaseBlockedByDrop(released!, Date.now())).toBe(false);
    expect((await admin.query(api.catalog.history.getVariantHistory, { variantId: cap.variantId }))[0]).toMatchObject({ type: "drop_changed", actor: RELEASE_BACKFILL_ACTOR });
    expect(await t.mutation(internal.catalog.migrations.releaseOverdueDrops, {})).toMatchObject({ count: 0 });
  });
});
