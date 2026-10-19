/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { actorEmail, diffFields, recordCatalogEvent } from "./audit";

const modules = import.meta.glob("/convex/**/*.ts");

describe("diffFields", () => {
  it("returns changed fields only", () => {
    expect(diffFields({ a: 1, b: [1] }, { a: 2, b: [1] })).toEqual([{ field: "a", from: 1, to: 2 }]);
  });

  it("returns [] when nothing changed", () => {
    expect(diffFields({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual([]);
  });

  it("treats undefined and a missing key as equal", () => {
    expect(diffFields({ a: undefined }, {})).toEqual([]);
    expect(diffFields({}, { a: undefined })).toEqual([]);
  });

  it("reports added and removed keys, skips _-prefixed keys", () => {
    expect(diffFields({ a: 1, _id: "x" }, { b: 2, _id: "y" })).toEqual([
      { field: "a", from: 1, to: undefined },
      { field: "b", from: undefined, to: 2 },
    ]);
  });
});

describe("actorEmail", () => {
  it("prefers email, falls back to subject", () => {
    expect(actorEmail({ email: "a@b.c", subject: "s" } as never)).toBe("a@b.c");
    expect(actorEmail({ subject: "s" } as never)).toBe("s");
  });
});

describe("getVariantHistory", () => {
  it("returns recorded events newest first with parsed changes", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await recordCatalogEvent(ctx, { variantId: "v1", type: "created", actor: "a@b.c" });
      await recordCatalogEvent(ctx, {
        variantId: "v1",
        type: "price_set",
        actor: "a@b.c",
        changes: [{ field: "priceUsd", from: 10, to: 12 }],
      });
      await recordCatalogEvent(ctx, { variantId: "other", type: "created", actor: "a@b.c" });
    });
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    const history = await admin.query(api.catalog.history.getVariantHistory, { variantId: "v1" });
    expect(history.map((e) => e.type)).toEqual(["price_set", "created"]);
    expect(history[0].changes).toEqual([{ field: "priceUsd", from: 10, to: 12 }]);
    expect(history[1].changes).toEqual([]);
  });

  it("round-trips changes with an absent from or to as null", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await recordCatalogEvent(ctx, {
        variantId: "v2",
        type: "updated",
        actor: "a@b.c",
        changes: [
          { field: "removed", from: 1, to: undefined },
          { field: "added", from: undefined, to: 2 },
        ],
      });
    });
    const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
    const history = await admin.query(api.catalog.history.getVariantHistory, { variantId: "v2" });
    expect(history[0].changes).toEqual([
      { field: "removed", from: 1, to: null },
      { field: "added", from: null, to: 2 },
    ]);
  });

  it("throws without an identity", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.catalog.history.getVariantHistory, { variantId: "v1" })).rejects.toThrow();
  });
});
