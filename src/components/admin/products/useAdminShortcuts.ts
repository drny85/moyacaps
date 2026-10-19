"use client";

import { useEffect, useRef } from "react";
import { isTypingTarget, shortcutKey, shouldHandle } from "@/lib/admin/shortcuts";
import type { ShortcutKey } from "@/lib/admin/shortcuts";

export type ShortcutMap = Partial<Record<ShortcutKey, (e: KeyboardEvent) => void>>;

/**
 * Global admin shortcuts (D11). Keys typed into a field are ignored except ⌘S/Ctrl+S and
 * Esc. Nothing fires while a dialog is open: the dialog owns the keyboard.
 */
export function useAdminShortcuts(map: ShortcutMap) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      const key = shortcutKey(e);
      const handler = key === "" ? undefined : ref.current[key];
      if (!handler || !shouldHandle(key, isTypingTarget(e.target as HTMLElement | null))) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
