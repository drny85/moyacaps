"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useMemo } from "react";
import { CapCard } from "./CapCard";
import { Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useCapVariants } from "@/hooks/useCapVariants";
import { Reveal } from "@/components/motion/Reveal";

import { useStore } from "@/store/useStore";
import { useSoundEffects } from "@/hooks/useSoundEffects";

export function CapGrid() {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const { openSneakerMatcher } = useStore();
  const { playClick } = useSoundEffects();

  type FilterKey = "all" | "tee" | "caps" | "snapback" | "trucker";
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { caps } = useCapVariants();

  const teeCount = caps.filter((c) => c.silhouette === "tee" || c.category === "apparel").length;
  const snapbackCount = caps.filter((c) => c.silhouette === "snapback").length;
  const truckerCount = caps.filter((c) => c.silhouette === "trucker").length;
  const capsCount = snapbackCount + truckerCount;

  const filteredCaps = useMemo(() => {
    return caps.filter((cap) => {
      const isTee = cap.silhouette === "tee" || cap.category === "apparel";
      const isCap = cap.silhouette === "snapback" || cap.silhouette === "trucker" || cap.category === "headwear";

      if (activeFilter === "tee" && !isTee) return false;
      if (activeFilter === "caps" && !isCap) return false;
      if (activeFilter === "snapback" && cap.silhouette !== "snapback") return false;
      if (activeFilter === "trucker" && cap.silhouette !== "trucker") return false;

      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const name = (locale === "es" ? cap.nameEs : cap.nameEn).toLowerCase();
        const id = cap.id.toLowerCase();
        const silhouette = (cap.silhouette || "").toLowerCase();
        const tag = ((locale === "es" ? cap.tagEs : cap.tagEn) || "").toLowerCase();
        return name.includes(query) || id.includes(query) || silhouette.includes(query) || tag.includes(query);
      }
      return true;
    });
  }, [caps, activeFilter, searchQuery, locale]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: locale === "es" ? `Todo (${caps.length})` : `All Releases (${caps.length})` },
    { key: "tee", label: locale === "es" ? `Playeras Boxy ($160) (${teeCount})` : `Heavyweight Tees ($160) (${teeCount})` },
    { key: "caps", label: locale === "es" ? `Gorras ($120) (${capsCount})` : `Caps ($120) (${capsCount})` },
    { key: "snapback", label: t("filterSnapback", { count: snapbackCount }) },
    { key: "trucker", label: t("filterTrucker", { count: truckerCount }) },
  ];

  return (
    <section id="catalog" className="py-16 sm:py-28 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
      {/* ── Section Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-14">
        <div>
          <Reveal y={12}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-moya-red mb-3">
              {t("eyebrow")}
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            <h2 className="font-poster uppercase text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-zinc-950 dark:text-white">
              {activeFilter === "tee"
                ? (locale === "es" ? "Playeras Heavyweight" : "Heavyweight Tees")
                : activeFilter === "caps" || activeFilter === "snapback" || activeFilter === "trucker"
                ? (locale === "es" ? "Gorras Insignia" : "Signature Caps")
                : (locale === "es" ? "Colección Oficial" : "Official Collection")}
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-lg mt-3 max-w-xl">
              {activeFilter === "tee"
                ? (locale === "es"
                    ? "Algodón peinado de 280-300 GSM, corte boxy drop-shoulder y serigrafía de alta definición a $160 USD."
                    : "Heavyweight 280-300 GSM combed cotton, boxy drop-shoulder silhouette, and high-density screen prints at $160 USD.")
                : t("subtitle")}
            </p>
          </Reveal>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-3 rounded-xl glass-dark text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 border border-black/[0.06] dark:border-white/[0.06] focus:outline-none focus:ring-1 focus:ring-moya-red/50 focus:border-moya-red/50 transition-all font-sans"
          />
        </div>
      </div>

      {/* ── Filter Tabs (chunky tactile toggles) ── */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-6 sm:mb-10 overflow-x-auto pb-2 scrollbar-none w-full">
        <div className="flex items-center gap-2 sm:gap-3">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                playClick();
                setActiveFilter(f.key);
              }}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-semibold transition-all whitespace-nowrap ${
                activeFilter === f.key
                  ? "bg-moya-red text-white shadow-lg shadow-moya-red-deep/40 scale-105"
                  : "glass-dark text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border border-black/[0.06] dark:border-white/[0.06]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sneaker & Fit Matcher Trigger */}
        <button
          type="button"
          onClick={() => {
            playClick();
            openSneakerMatcher(null);
          }}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs sm:text-sm font-display font-semibold border border-black/10 dark:border-white/15 hover:border-black/25 dark:hover:border-white/30 text-zinc-800 dark:text-zinc-200 shadow-xs shrink-0 transition-all active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{locale === "es" ? "Emparejador de Tenis" : "Sneaker Matcher"}</span>
        </button>
      </div>

      {/* ── Grid ── */}
      {filteredCaps.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-zinc-600 dark:text-zinc-400">
          <p className="text-lg font-display">No colorways match &quot;{searchQuery}&quot;</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="mt-4 px-5 py-2.5 rounded-xl bg-moya-red text-white text-xs font-display font-bold hover:bg-rose-500 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5 w-full"
        >
          {filteredCaps.map((cap, idx) => (
            <CapCard key={cap.id} cap={cap} index={idx} />
          ))}
        </motion.div>
      )}
    </section>
  );
}
