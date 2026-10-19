"use client";

import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import { launchChatUrl, launchWhatsAppText } from "@/lib/admin/categoryLaunch";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com";

/**
 * A Coming Soon category's waitlist (ADR 0022). Email subscribers are emailed automatically
 * at launch; WhatsApp subscribers are messaged by hand from here and then marked notified.
 */
export function CategoryWaitlist({ category }: { category: Category }) {
  const t = useTranslations("admin.launch");
  const locale = useLocale();
  const rows = useQuery(api.notifications.launchAlerts.getCategoryWaitlistAdmin, { category });
  const markNotified = useMutation(api.notifications.launchAlerts.markAlertNotified);
  const name = t(`category.${category}`);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
      <div>
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("waitlistTitle", { name, count: rows.length })}</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("waitlistSubtitle")}</p>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06] text-xs">
        {rows.map((row) => (
          <li key={row._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            {row.channel === "email" ? <Mail className="w-3.5 h-3.5 text-zinc-400" /> : <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />}
            <span className="font-mono text-zinc-900 dark:text-white break-all">{row.contact}</span>
            {row.name && <span className="text-zinc-500">{row.name}</span>}
            <span className="text-zinc-400">{new Date(row.createdAt).toLocaleDateString(locale)}</span>
            <span className="ml-auto flex items-center gap-2">
              {row.notifiedAt !== undefined ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  {t("notified")}
                </span>
              ) : row.channel === "whatsapp" ? (
                <>
                  <a
                    href={launchChatUrl(row.contact, launchWhatsAppText(row.locale, category, SITE_URL))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold"
                  >
                    {t("openChat")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button type="button" onClick={() => void markNotified({ id: row._id })} className="font-semibold text-zinc-700 dark:text-zinc-300 underline">
                    {t("markNotified")}
                  </button>
                </>
              ) : (
                <span className="text-zinc-400">{t("emailAtLaunch")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
