"use client";

import { useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { soundFx } from "@/lib/audio";

export function useSoundEffects() {
  const soundEnabled = useStore((s) => s.soundEnabled);

  useEffect(() => {
    soundFx.setMuted(!soundEnabled);
  }, [soundEnabled]);

  const playClick = useCallback(() => {
    soundFx.playClick();
  }, []);

  const playToggle = useCallback((isOn?: boolean) => {
    soundFx.playToggle(isOn);
  }, []);

  const playSuccessChime = useCallback(() => {
    soundFx.playSuccessChime();
  }, []);

  const playRadarPing = useCallback(() => {
    soundFx.playRadarPing();
  }, []);

  return {
    soundEnabled,
    playClick,
    playToggle,
    playSuccessChime,
    playRadarPing,
  };
}
