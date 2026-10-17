"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where Tab should go inside a trap of `count` focusable elements when focus is at
 * `current` (-1 = outside the trap). Returns null when the browser's own move is fine.
 */
export function wrapFocus(current: number, count: number, backwards: boolean): number | null {
  if (count === 0) return null;
  if (current === -1) return backwards ? count - 1 : 0;
  if (backwards && current === 0) return count - 1;
  if (!backwards && current === count - 1) return 0;
  return null;
}

/**
 * Modal focus handling: while `active`, focus moves into `container` (to `initialFocus` or
 * its first focusable element), Tab and Shift+Tab cycle inside it, and on release focus
 * returns to whatever had it before (e.g. the button that opened the dialog).
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocus?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active) return;
    const root = container.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

    (initialFocus?.current ?? focusables()[0] ?? root).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const target = wrapFocus(items.indexOf(document.activeElement as HTMLElement), items.length, e.shiftKey);
      if (target !== null) {
        e.preventDefault();
        items[target].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, container, initialFocus]);
}
