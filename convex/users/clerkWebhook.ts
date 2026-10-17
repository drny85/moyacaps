import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Webhook } from "svix";
import { toUserUpsert, type ClerkUserJSON } from "./clerk";

/** Clerk -> Convex user mirror. Routed at POST /clerk-users-webhook in convex/http.ts. */
export const clerkUsersWebhook = httpAction(async (ctx, request) => {
  // Each Convex deployment has its own Clerk endpoint, so each has its own signing secret.
  // Refuse unsigned payloads everywhere: an unverified user.created naming the admin
  // email would otherwise mint an admin row.
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set on this deployment.");
    return new Response("Webhook secret unconfigured", { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let event: { type: string; data: any };
  try {
    event = new Webhook(webhookSecret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as typeof event;
  } catch (err: any) {
    console.error("Error verifying Clerk webhook:", err?.message || err);
    return new Response("Invalid webhook signature", { status: 400 });
  }

  try {
    const eventType = event.type;
    const data = event.data;

    if (eventType === "user.created" || eventType === "user.updated") {
      // Admins never lose access through webhook chatter: upsertUser refuses to demote
      // an established admin row. Removal is a deliberate act via the lib/auth.ts allowlist.
      await ctx.runMutation(
        internal.users.functions.upsertUser,
        toUserUpsert(data as ClerkUserJSON),
      );
    } else if (eventType === "user.deleted") {
      const clerkId = data.id;
      if (clerkId) {
        await ctx.runMutation(internal.users.functions.softDeleteUser, {
          clerkId,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error executing Clerk webhook action:", err?.message || err);
    return new Response(err?.message || "Webhook processing error", {
      status: 500,
    });
  }
});
