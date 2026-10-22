import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";
import { TrackLookup } from "@/components/track/TrackLookup";

/**
 * Static page: the header is server-rendered (and indexable), and the lookup, which reads
 * `?order=` in the browser to prefill the form, renders under Suspense with a form skeleton.
 */
export default async function TrackOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "track" });

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-[#07070b] pt-28 pb-20 px-4 sm:px-6 transition-colors">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-moya-red/10 text-moya-red border border-moya-red/20 mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>{t("badge")}</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <Suspense fallback={<LookupCardSkeleton />}>
          <TrackLookup />
        </Suspense>
      </div>
    </div>
  );
}

/** Same footprint as the lookup card, so the page does not jump when the form mounts. */
function LookupCardSkeleton() {
  return (
    <div
      className="p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl space-y-4"
      aria-busy="true"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
        <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="h-11 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
    </div>
  );
}
