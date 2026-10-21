/**
 * Where admin alerts go, for the Settings page. Read-only: the address lives in the
 * deployment's ADMIN_NOTIFICATION_EMAIL (plan 0009 D19), never in the database.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { PRIMARY_ADMIN_EMAIL, requireAdmin } from "../lib/auth";
import { resolveAdminRecipient } from "./adminRecipient";

export const getAdminRecipient = query({
  args: {},
  returns: v.object({ email: v.string(), fromEnv: v.boolean() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return resolveAdminRecipient(process.env.ADMIN_NOTIFICATION_EMAIL, PRIMARY_ADMIN_EMAIL);
  },
});
