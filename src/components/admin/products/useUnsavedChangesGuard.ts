"use client";

import { useEffect, useRef } from "react";
import { shouldGuardClick } from "@/lib/admin/navigationGuard";

/**
 * Asks before unsaved edits are lost (D7): closing or reloading the tab
 * (`beforeunload`), clicking an in-app link (a capture-phase listener runs before
 * the router's own click handler), and the browser back button (a duplicate history
 * entry absorbs the first Back so the editor can ask).
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string) {
  const dirty = useRef(isDirty);
  const sentinel = useRef(false);

  useEffect(() => {
    dirty.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const link = { href: anchor.getAttribute("href") ?? "", target: anchor.target, download: anchor.hasAttribute("download") };
      const mods = { meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, button: e.button };
      if (!shouldGuardClick(link, mods, window.location.href) || window.confirm(message)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isDirty, message]);

  // Back button: the first dirty edit adds a same-URL entry. Back lands on the original
  // entry (the page stays); leaving then goes back once more, staying re-adds the entry.
  useEffect(() => {
    if (!isDirty || sentinel.current) return;
    sentinel.current = true;
    window.history.pushState(window.history.state, "", window.location.href);
    const onPopState = () => {
      if (!dirty.current || window.confirm(message)) {
        window.removeEventListener("popstate", onPopState);
        sentinel.current = false;
        if (dirty.current) {
          dirty.current = false;
          window.history.back();
        }
        return;
      }
      window.history.pushState(window.history.state, "", window.location.href);
    };
    window.addEventListener("popstate", onPopState);
    // The listener outlives clean/dirty flips; it is removed when it lets the user leave.
  }, [isDirty, message]);

  useEffect(
    () => () => {
      dirty.current = false;
    },
    []
  );
}
