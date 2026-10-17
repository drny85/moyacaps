"use client";

import { useEffect } from "react";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Native scrolling for visitors who ask for reduced motion, and on touch screens,
    // where Lenis leaves touch scrolling native anyway. Lenis loads as its own chunk
    // so it stays off the first-load path (ADR 0018).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let cancelled = false;
    let frame = 0;
    let lenis: import("lenis").default | null = null;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const instance = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
      });
      lenis = instance;
      (window as any).__lenis = instance;

      function raf(time: number) {
        instance.raf(time);
        frame = requestAnimationFrame(raf);
      }
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (lenis) {
        if ((window as any).__lenis === lenis) {
          delete (window as any).__lenis;
        }
        lenis.destroy();
      }
    };
  }, []);

  return <>{children}</>;
}
