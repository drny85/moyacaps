"use client";

import { useStore } from "@/store/useStore";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function ThemeToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { theme, toggleTheme } = useStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDark = isMounted ? theme === "dark" : true;

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative rounded-xl glass-pill transition-all duration-300 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 group focus:outline-none focus:ring-1 focus:ring-moya-red/50 ${
        compact ? "w-8 h-8 sm:w-9 sm:h-9" : "h-9 px-2.5 gap-2"
      } ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light Mode" : "Dark Mode"}
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 0 : 180,
          scale: isDark ? 1 : 1,
        }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center justify-center"
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-zinc-300 group-hover:text-moya-violet transition-colors" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
        )}
      </motion.div>

      {!compact && (
        <span className="text-[11px] font-display font-semibold uppercase tracking-wider hidden md:inline">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}
