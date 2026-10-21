/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
  return { t, admin };
}

describe("getAdminRecipient", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the primary Administrator when the env var is unset", async () => {
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");
    const { admin } = setup();
    expect(await admin.query(api.notifications.settings.getAdminRecipient, {})).toEqual({
      email: PRIMARY_ADMIN_EMAIL,
      fromEnv: false,
    });
  });

  it("returns the env address when valid", async () => {
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "ops@example.com");
    const { admin } = setup();
    expect(await admin.query(api.notifications.settings.getAdminRecipient, {})).toEqual({
      email: "ops@example.com",
      fromEnv: true,
    });
  });

  it("rejects non-admins", async () => {
    const { t } = setup();
    await expect(t.query(api.notifications.settings.getAdminRecipient, {})).rejects.toThrow();
  });
});
