"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { usePageSettled } from "@/lib/pageSettled";

/**
 * A `fill` next/image that starts loading only once the page has settled (see
 * pageSettled) or its box scrolls into view, whichever comes first (ADR 0020).
 * Chrome's native lazy loading fetches anything within ~1250 px of the viewport during
 * first load, so a grid's offscreen rows would compete with the LCP image. Until then an
 * empty box holds the place; the parent sets the size and background, so nothing shifts.
 * Use plain `Image` for anything visible in the first viewport.
 */
export function DeferredImage(props: ImageProps & { fill: true }) {
  const settled = usePageSettled();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const show = settled || inView;

  useEffect(() => {
    const el = ref.current;
    if (show || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [show]);

  if (show) return <Image {...props} />;
  return <span ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}
