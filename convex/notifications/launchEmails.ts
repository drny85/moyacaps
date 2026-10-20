"use node";

/** Sends the "now live" emails for a category's waitlist (ADR 0022). Rows were stamped by `claimLaunchEmails`. */
import { v } from "convex/values";
import React from "react";
import { renderEmail } from "./templates/layout/renderEmail";
import { internalAction } from "../_generated/server";
import { resend } from "./emails";
import { categoryValidator } from "../settings/launch";
import { CategoryLaunchEmail, categoryLaunchSubject } from "./templates/CategoryLaunchEmail";

const SENDER = process.env.RESEND_FROM_EMAIL || "Good Luck Alerts <onboarding@resend.dev>";
const SHOP_CATEGORY = { headwear: "caps", apparel: "tees" } as const;

export const sendLaunchEmails = internalAction({
  args: {
    category: categoryValidator,
    recipients: v.array(
      v.object({
        id: v.id("drop_alerts"),
        contact: v.string(),
        locale: v.union(v.literal("en"), v.literal("es")),
        name: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { category, recipients }) => {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com").replace(/\/$/, "");
    for (const r of recipients) {
      if (!r.contact.includes("@")) continue;
      try {
        const shopUrl = `${baseUrl}/${r.locale}/products?category=${SHOP_CATEGORY[category]}`;
        const email = await renderEmail(React.createElement(CategoryLaunchEmail, { locale: r.locale, category, name: r.name, shopUrl }));
        await resend.sendEmail(ctx, {
          from: SENDER,
          to: r.contact,
          subject: categoryLaunchSubject(r.locale, category),
          html: email.html,
          text: email.text,
          idempotencyKey: `category-launch-${r.id}`,
        });
      } catch (error) {
        console.error(`[CategoryLaunchEmail] Failed for alert ${r.id}:`, error);
      }
    }
    return null;
  },
});
