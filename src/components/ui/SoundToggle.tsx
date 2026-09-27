"use client";

import { useStore } from "@/store/useStore";
import { soundFx } from "@/lib/audio";
import { Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

interface SoundToggleProps {
  compact?: boolean;
}

export function SoundToggle({ compact = false }: SoundToggleProps) {
  const { soundEnabled, toggleSound } = useStore();

  const handleToggle = () => {
    const next = !soundEnabled;
    toggleSound();
    if (next) {
      soundFx.setMuted(false);
      soundFx.playToggle(true);
    } else {
      soundFx.setMuted(true);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative flex items-center justify-center rounded-xl glass-dark border border-black/[0.06] dark:border-white/[0.06] hover:border-black/15 dark:hover:border-white/20 transition-all ${
        compact ? "w-8 h-8 sm:w-9 sm:h-9" : "px-3 py-1.5 gap-2 text-xs font-display font-medium"
      } ${soundEnabled ? "text-moya-green" : "text-zinc-400 dark:text-zinc-600"}`}
      title={soundEnabled ? "Mute Haptic Soundscapes" : "Enable Haptic Soundscapes"}
      aria-label={soundEnabled ? "Mute audio" : "Enable audio"}
    >
      <motion.div
        key={soundEnabled ? "sound-on" : "sound-off"}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-1.5"
      >
        {soundEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            {!compact && <span>Audio On</span>}
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5" />
            {!compact && <span>Audio Off</span>}
          </>
        )}
      </motion.div>
    </button>
  );
}
