"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readSoundPreference, subscribeSoundPreference, writeSoundPreference } from "@/lib/admin/soundPreference";

const subscribe = (onChange: () => void) => subscribeSoundPreference(window, onChange);
const getSnapshot = () => readSoundPreference(window.localStorage);
const getServerSnapshot = () => true;

/** The order-chime preference, shared by the admin shell and Settings → Alerts. */
export function useSoundPreference(): [enabled: boolean, setEnabled: (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setEnabled = useCallback((next: boolean) => writeSoundPreference(window.localStorage, next, window), []);
  return [enabled, setEnabled];
}
