"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, X, Zap } from "lucide-react";
import { useLocale } from "next-intl";
import { useSoundEffects } from "@/hooks/useSoundEffects";

interface LiveActivity {
  id: string;
  locationEn: string;
  locationEs: string;
  capNameEn: string;
  capNameEs: string;
  actionEn: string;
  actionEs: string;
  timeAgoEn: string;
  timeAgoEs: string;
}

const COLLECTOR_ACTIVITIES: LiveActivity[] = [
  {
    id: "act-1",
    locationEn: "Los Angeles, CA",
    locationEs: "Los Ángeles, CA",
    capNameEn: "Negro / Rojo (0880 Signature)",
    capNameEs: "Negro / Rojo (Insignia 0880)",
    actionEn: "secured",
    actionEs: "aseguró",
    timeAgoEn: "2m ago",
    timeAgoEs: "hace 2m",
  },
  {
    id: "act-2",
    locationEn: "Miami, FL",
    locationEs: "Miami, FL",
    capNameEn: "Royal / Blanco",
    capNameEs: "Royal / Blanco",
    actionEn: "claimed",
    actionEs: "adquirió",
    timeAgoEn: "4m ago",
    timeAgoEs: "hace 4m",
  },
  {
    id: "act-3",
    locationEn: "New York, NY",
    locationEs: "Nueva York, NY",
    capNameEn: "Olivo / Dorado",
    capNameEs: "Olivo / Dorado",
    actionEn: "reserved via Concierge",
    actionEs: "apartó vía Concierge",
    timeAgoEn: "6m ago",
    timeAgoEs: "hace 6m",
  },
  {
    id: "act-4",
    locationEn: "Houston, TX",
    locationEs: "Houston, TX",
    capNameEn: "Chocolate / Dorado",
    capNameEs: "Chocolate / Dorado",
    actionEn: "secured",
    actionEs: "aseguró",
    timeAgoEn: "8m ago",
    timeAgoEs: "hace 8m",
  },
  {
    id: "act-5",
    locationEn: "Chicago, IL",
    locationEs: "Chicago, IL",
    capNameEn: "Negro / Gris",
    capNameEs: "Negro / Gris",
    actionEn: "added to bag",
    actionEs: "agregó a su bolsa",
    timeAgoEn: "11m ago",
    timeAgoEs: "hace 11m",
  },
  {
    id: "act-6",
    locationEn: "San Antonio, TX",
    locationEs: "San Antonio, TX",
    capNameEn: "Blanco / Rojo",
    capNameEs: "Blanco / Rojo",
    actionEn: "secured",
    actionEs: "aseguró",
    timeAgoEn: "14m ago",
    timeAgoEs: "hace 14m",
  },
];

export function LiveCollectorFeed() {
  const locale = useLocale();
  const isEs = locale === "es";
  const { playClick } = useSoundEffects();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isDismissed || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % COLLECTOR_ACTIVITIES.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isDismissed, isPaused]);

  if (isDismissed) return null;

  const current = COLLECTOR_ACTIVITIES[currentIndex];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 max-w-xs sm:max-w-sm pointer-events-auto print:hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ y: 15, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -15, opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          className="relative px-3.5 py-2.5 rounded-2xl glass-dark border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 overflow-hidden group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {isEs ? current.locationEs : current.locationEn}
                </span>
                <span>•</span>
                <span>{isEs ? current.timeAgoEs : current.timeAgoEn}</span>
              </div>
              <p className="text-xs font-display font-medium text-zinc-900 dark:text-white truncate">
                <span className="text-moya-red font-bold">
                  {isEs ? current.actionEs : current.actionEn}
                </span>{" "}
                {isEs ? current.capNameEs : current.capNameEn}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClick();
              setIsDismissed(true);
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
