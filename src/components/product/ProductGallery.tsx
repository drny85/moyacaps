"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { GallerySlide } from "@/lib/productOptions";

const tileBg = (s: GallerySlide) => (s.kind === "artwork" ? "bg-white" : "bg-[#ECEAE6]");

/**
 * Product images (ADR 0016), Catalog Shot first. Phones get a native scroll-snap strip
 * (no gesture library, nothing to fight the page scroll); from `lg` up the same slides
 * lay out as a grid beside the sticky purchase panel. Any image opens full size.
 */
export function ProductGallery({ slides, resetKey }: { slides: GallerySlide[]; resetKey: string }) {
  const t = useTranslations("product");
  const stripRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  // A new colorway brings new photos: start again from the first one.
  useEffect(() => {
    stripRef.current?.scrollTo({ left: 0 });
    setActive(0);
  }, [resetKey]);

  // Track the slide in view for the dots (phones only; the grid shows every image).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root: strip, threshold: 0.6 }
    );
    strip.querySelectorAll("li").forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [slides]);

  return (
    <section aria-label={t("galleryLabel")} className="relative">
      <ul
        ref={stripRef}
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <li
            key={`${slide.src}-${i}`}
            data-index={i}
            className={`relative aspect-[4/5] w-[88%] shrink-0 snap-center overflow-hidden rounded-[14px] sm:w-[70%] lg:w-auto ${tileBg(slide)} ${
              i === 0 ? "lg:col-span-2 lg:aspect-[5/4]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`${t("openImage")}: ${slide.alt}`}
              className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-moya-red"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : undefined}
                sizes={i === 0 ? "(min-width: 1024px) 58vw, 88vw" : "(min-width: 1024px) 29vw, 88vw"}
                className={slide.fit === "contain" ? "object-contain p-[8%]" : "object-cover"}
              />
            </button>
          </li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={`${s.src}-dot`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-zinc-900 dark:bg-white" : "w-1.5 bg-zinc-300 dark:bg-white/25"}`}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {t("slideOf", { index: active + 1, count: slides.length })}
      </p>

      {open !== null && slides[open] && <Lightbox slide={slides[open]} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Lightbox({ slide, onClose }: { slide: GallerySlide; onClose: () => void }) {
  const t = useTranslations("product");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useLockBodyScroll(true);
  useFocusTrap(dialogRef, true, closeRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={slide.alt}
      data-lenis-prevent
      className={`fixed inset-0 z-[60] ${tileBg(slide)} [touch-action:pinch-zoom]`}
      onClick={onClose}
    >
      <Image src={slide.src} alt={slide.alt} fill sizes="100vw" className="object-contain" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("closeImage")}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-zinc-900 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
