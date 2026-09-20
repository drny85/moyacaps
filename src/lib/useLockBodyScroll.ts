"use client";

import { useEffect } from "react";

// Global counter to support nested modals and concurrent dialogs without releasing early
let activeLockCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";
let originalBodyPaddingRight = "";

export function useLockBodyScroll(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof window === "undefined") return;

    if (activeLockCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverflow = document.documentElement.style.overflow;
      originalBodyPaddingRight = document.body.style.paddingRight;

      // Compensate for scrollbar removal to prevent layout shift
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      // Pause Lenis smooth scroll if present on window
      const win = window as any;
      if (win.__lenis && typeof win.__lenis.stop === "function") {
        win.__lenis.stop();
      }
    }

    activeLockCount++;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);

      if (activeLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.paddingRight = originalBodyPaddingRight;

        // Resume Lenis smooth scroll
        const win = window as any;
        if (win.__lenis && typeof win.__lenis.start === "function") {
          win.__lenis.start();
        }
      }
    };
  }, [isLocked]);
}
