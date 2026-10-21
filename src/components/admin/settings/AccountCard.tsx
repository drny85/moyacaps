"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SafeUserButton } from "@/lib/useSafeUser";

const LOCALES = ["en", "es"] as const;

/** Language, theme and the signed-in Administrator. */
export function AccountCard() {
  const t = useTranslations("admin.settings.account");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
      <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("language")}</span>
        <div role="radiogroup" aria-label={t("language")} className="flex bg-zinc-200/70 dark:bg-white/[0.06] rounded-lg p-0.5 font-mono font-medium">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              onClick={() => router.replace(pathname, { locale: l })}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                locale === l ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold" : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("theme")}</span>
        <ThemeToggle compact />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs pt-3 border-t border-zinc-200/60 dark:border-white/[0.04]">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("signedIn")}</span>
        <SafeUserButton />
      </div>
    </section>
  );
}
