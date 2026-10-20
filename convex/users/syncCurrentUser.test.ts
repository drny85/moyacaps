/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

const allUsers = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("users").take(10));

describe("syncCurrentUser (users/functions)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the row with the token's email, trimmed and lowercased", async () => {
    const t = convexTest(schema, modules);
    const id = await t
      .withIdentity({ subject: "user_a", email: "  Ana@Example.com ", name: "Ana Diaz" })
      .mutation(api.users.functions.syncCurrentUser, {});

    expect(id).not.toBeNull();
    const [row] = await allUsers(t);
    expect(row).toMatchObject({ clerkId: "user_a", email: "ana@example.com", name: "Ana Diaz", role: "customer" });
  });

  it("creates no row when the token carries no email claim", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);

    const id = await t.withIdentity({ subject: "user_b" }).mutation(api.users.functions.syncCurrentUser, {});

    expect(id).toBeNull();
    expect(await allUsers(t)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no email claim"));
  });

  it("treats a blank email claim as missing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);

    const id = await t
      .withIdentity({ subject: "user_c", email: "   " })
      .mutation(api.users.functions.syncCurrentUser, {});

    expect(id).toBeNull();
    expect(await allUsers(t)).toHaveLength(0);
  });

  it("keeps an existing row's email when a later token has none", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const created = await t
      .withIdentity({ subject: "user_d", email: "dee@example.com" })
      .mutation(api.users.functions.syncCurrentUser, {});

    const synced = await t
      .withIdentity({ subject: "user_d", name: "Dee Ray" })
      .mutation(api.users.functions.syncCurrentUser, {});

    expect(synced).toBe(created);
    const [row] = await allUsers(t);
    expect(row).toMatchObject({ email: "dee@example.com", name: "Dee Ray" });
  });
});
