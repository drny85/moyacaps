"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useSoundPreference } from "@/hooks/useSoundPreference";

/** Where admin alerts go (read-only: an env var) and whether new Orders chime in this browser. */
export function AlertsCard() {
  const t = useTranslations("admin.settings.alerts");
  const recipient = useQuery(api.notifications.settings.getAdminRecipient, {});
  const [chime, setChime] = useSoundPreference();

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="flex items-start gap-3 text-xs">
        <Bell className="w-4 h-4 mt-0.5 text-zinc-500 shrink-0" />
        <div className="min-w-0">
          <span className="font-medium text-zinc-700 dark:text-zinc-300 block">{t("recipient")}</span>
          <span className="font-mono text-zinc-900 dark:text-white break-all">{recipient ? recipient.email : "…"}</span>
          {recipient && !recipient.fromEnv && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{t("fallback")}</p>
          )}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
        <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
          {chime ? <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-400" />}
          {t("chime")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={chime}
          aria-label={t("chime")}
          onClick={() => setChime(!chime)}
          className={`relative w-10 h-6 rounded-full transition-colors ${chime ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${chime ? "translate-x-4" : ""}`} />
        </button>
      </label>
    </section>
  );
}
