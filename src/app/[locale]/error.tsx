"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

/**
 * Storefront error boundary: a client crash (for example browser translation rewriting text
 * React still owns) lands here instead of Next's bare "This page couldn't load" screen.
 * The bag lives in local storage, so retrying loses nothing.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div translate="no" className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-3 font-display text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
      <p className="mb-8 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t("body")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center justify-center rounded-full bg-moya-red px-6 font-display font-bold text-white hover:bg-moya-red-deep"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 px-6 font-display font-bold text-zinc-900 dark:border-white/15 dark:text-white"
        >
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
