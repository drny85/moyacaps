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
    locationEn: "Mexico City",
    locationEs: "Ciudad de México",
    capNameEn: "Negro / Rojo (0880 Signature)",
    capNameEs: "Negro / Rojo (Insignia 0880)",
    actionEn: "secured",
    actionEs: "aseguró",
    timeAgoEn: "1m ago",
    timeAgoEs: "hace 1m",
  },
  {
    id: "act-2",
    locationEn: "Miami, FL",
    locationEs: "Miami, FL",
    capNameEn: "Royal / Blanco",
    capNameEs: "Royal / Blanco",
    actionEn: "claimed",
    actionEs: "adquirió",
    timeAgoEn: "3m ago",
    timeAgoEs: "hace 3m",
  },
  {
    id: "act-3",
    locationEn: "Guadalajara",
    locationEs: "Guadalajara",
    capNameEn: "Olivo / Dorado",
    capNameEs: "Olivo / Dorado",
    actionEn: "reserved via Concierge",
    actionEs: "apartó vía Concierge",
    timeAgoEn: "5m ago",
    timeAgoEs: "hace 5m",
  },
  {
    id: "act-4",
    locationEn: "Monterrey",
    locationEs: "Monterrey",
    capNameEn: "Chocolate / Dorado",
    capNameEs: "Chocolate / Dorado",
    actionEn: "secured",
    actionEs: "aseguró",
    timeAgoEn: "7m ago",
    timeAgoEs: "hace 7m",
  },
  {
    id: "act-5",
    locationEn: "Los Angeles, CA",
    locationEs: "Los Ángeles, CA",
    capNameEn: "Negro / Gris",
    capNameEs: "Negro / Gris",
    actionEn: "added to bag",
    actionEs: "agregó a su bolsa",
    timeAgoEn: "9m ago",
    timeAgoEs: "hace 9m",
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
    }, 7000);
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
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative p-3 rounded-2xl glass-dark border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 overflow-hidden group"
        >
          {/* Subtle animated border laser light */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-moya-green to-transparent opacity-80" />

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-8 h-8 rounded-xl bg-moya-green/15 text-moya-green flex items-center justify-center shrink-0 border border-moya-green/30">
              <Zap className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-moya-green ring-2 ring-[#09090c]" />
            </div>

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
