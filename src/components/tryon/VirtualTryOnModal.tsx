"use client";

import { useEffect, useRef } from "react";
import { m } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { TryOnStudio } from "./TryOnStudio";

/** The Try-On over the product page: a full-height sheet on phones, a centred panel on desktop */
export function VirtualTryOnModal() {
  const isOpen = useStore((s) => s.isTryOnOpen);
  const close = useStore((s) => s.closeTryOn);
  const target = useStore((s) => s.tryOnTargetCap);
  const panelRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll(isOpen);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm sm:p-6" data-lenis-prevent onClick={close}>
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="try-on-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto min-h-full w-full max-w-6xl bg-white px-4 pb-6 pt-5 dark:bg-zinc-950 sm:min-h-0 sm:rounded-[24px] sm:p-8"
      >
        <TryOnStudio initialCapId={target?.id ?? null} onClose={close} headingId="try-on-title" as="h2" />
      </m.div>
    </div>
  );
}
