"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { CapCard } from "./CapCard";
import { Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";

export function CapGrid() {
  const t = useTranslations("catalog");
  const locale = useLocale();

  const [activeFilter, setActiveFilter] = useState<"all" | "snapback" | "trucker">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const convexVariants = useQuery(api.products.getVariants, {});

  const caps: CapVariant[] = useMemo(() => {
    if (convexVariants && convexVariants.length > 0) {
      return convexVariants.map((v) => ({
        id: v.variantId,
        nameEn: v.nameEn,
        nameEs: v.nameEs,
        silhouette: (v.silhouette as "snapback" | "trucker") || "snapback",
        primaryHex: v.primaryHex,
        secondaryHex: v.secondaryHex,
        image: v.image,
        stock: v.stock,
        priceUsd: v.priceUsd,
        isFeatured: v.isFeatured,
        tagEn: v.isFeatured ? "Signature Edition" : undefined,
        tagEs: v.isFeatured ? "Edición Insignia" : undefined,
        isDrop: v.isDrop,
        dropDate: v.dropDate,
        dropBadgeTextEn: v.dropBadgeTextEn,
        dropBadgeTextEs: v.dropBadgeTextEs,
        dropStatus: v.dropStatus,
      }));
    }
    return CAP_VARIANTS;
  }, [convexVariants]);

  const snapbackCount = caps.filter((c) => c.silhouette === "snapback").length;
  const truckerCount = caps.filter((c) => c.silhouette === "trucker").length;

  const filteredCaps = useMemo(() => {
    return caps.filter((cap) => {
      if (activeFilter !== "all" && cap.silhouette !== activeFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const name = (locale === "es" ? cap.nameEs : cap.nameEn).toLowerCase();
        const id = cap.id.toLowerCase();
        return name.includes(query) || id.includes(query);
      }
      return true;
    });
  }, [caps, activeFilter, searchQuery, locale]);

  const filters: { key: "all" | "snapback" | "trucker"; label: string }[] = [
    { key: "all", label: t("filterAll", { count: caps.length }) },
    { key: "snapback", label: t("filterSnapback", { count: snapbackCount }) },
    { key: "trucker", label: t("filterTrucker", { count: truckerCount }) },
  ];

  return (
    <section id="catalog" className="py-16 sm:py-28 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
      {/* ── Section Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-14">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="sticker-badge sticker-badge--green mb-4"
          >
            <Sparkles className="w-3 h-3" />
            <span>{t("eyebrow")}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            {t("title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-lg mt-2 max-w-xl"
          >
            {t("subtitle")}
          </motion.p>
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
      <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-10 overflow-x-auto pb-2 scrollbar-none w-full">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
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
