"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { NYC_LOOKBOOK, type LookbookScene } from "@/data/lookbook";
import { sceneKeyframes, shoppableHotspots, valueAt, type ShoppableHotspot } from "@/lib/lookbook";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useMotionPrefs } from "@/hooks/useMotionPrefs";
import { useParallax } from "@/hooks/useParallax";
import { LookbookHotspot } from "@/components/story/LookbookHotspot";

type Scene = LookbookScene & { shoppable: ShoppableHotspot[] };

/**
 * "Good Luck, NYC": three real street photos, shoppable by tapping the tees.
 * With a mouse on a desktop screen the photos crossfade inside a pinned frame while the
 * place names slide past (one scroll-driven moment); on touch, small screens and reduced
 * motion they are stacked panels with a light parallax (ADR 0016 budget).
 */
export function NycLookbook() {
  const { caps: catalog } = useCapVariants();
  const { allowPinned } = useMotionPrefs();
  const scenes: Scene[] = useMemo(
    () => NYC_LOOKBOOK.map((s) => ({ ...s, shoppable: shoppableHotspots(s.hotspots, catalog) })),
    [catalog]
  );
  return allowPinned ? <PinnedStory scenes={scenes} /> : <StackedStory scenes={scenes} />;
}

function Heading({ id }: { id: string }) {
  const t = useTranslations("home");
  return (
    <div>
      <h2 id={id} className="font-poster text-5xl uppercase leading-none text-zinc-950 dark:text-white sm:text-6xl">{t("nycTitle")}</h2>
      <p className="mt-2 max-w-sm text-base text-zinc-600 dark:text-zinc-400">{t("nycBody")}</p>
    </div>
  );
}

function Hotspots({ scene, active }: { scene: Scene; active: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!active) return null;
  return (
    <>
      {scene.shoppable.map((h, i) => (
        <LookbookHotspot
          key={`${scene.id}-${h.productId}-${i}`}
          hotspot={h}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
          onClose={() => setOpen(null)}
        />
      ))}
    </>
  );
}

// ── Desktop: pinned crossfade ───────────────────────────────────────────────

function PinnedStory({ scenes }: { scenes: Scene[] }) {
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(scenes.length - 1, Math.max(0, Math.floor(p * scenes.length)));
    setActive((prev) => (prev === next ? prev : next));
  });

  return (
    <section
      ref={ref}
      id="lookbook"
      aria-labelledby="nyc-lookbook"
      className="relative"
      style={{ height: `${scenes.length * 90 + 30}vh` }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-8">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-12 items-center gap-10">
          <div className="relative col-span-5 aspect-[3/4] max-h-[80svh] overflow-hidden rounded-[18px] bg-zinc-900">
            {scenes.map((s, i) => (
              <ScenePhoto key={s.id} scene={s} index={i} count={scenes.length} progress={scrollYProgress} locale={locale} />
            ))}
            {scenes.map((s, i) => (
              <Hotspots key={s.id} scene={s} active={i === active} />
            ))}
          </div>

          <div className="col-span-7">
            <Heading id="nyc-lookbook" />
            <div className="relative mt-10 h-[clamp(8rem,16vw,15rem)]">
              {scenes.map((s, i) => (
                <PlaceName key={s.id} text={locale === "es" ? s.place.es : s.place.en} index={i} count={scenes.length} progress={scrollYProgress} />
              ))}
            </div>
            <div className="mt-8 flex max-w-sm gap-2" aria-hidden>
              {scenes.map((s, i) => (
                <span key={s.id} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= active ? "bg-moya-red" : "bg-black/10 dark:bg-white/15"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScenePhoto({
  scene,
  index,
  count,
  progress,
  locale,
}: {
  scene: Scene;
  index: number;
  count: number;
  progress: MotionValue<number>;
  locale: string;
}) {
  const k = sceneKeyframes(index, count);
  // Function transforms run in JS on the section's own progress (array transforms can be
  // handed to the browser's scroll timeline, which tracks a different range)
  const opacity = useTransform(progress, (p) => valueAt(p, k.input, k.opacity));
  // Slow push-in while the scene is on screen
  const scale = useTransform(progress, (p) => valueAt(p, [index / count, (index + 1) / count], [1.08, 1]));
  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0">
      <Image
        src={scene.src}
        alt={locale === "es" ? scene.alt.es : scene.alt.en}
        fill
        sizes="(min-width: 1280px) 34vw, 40vw"
        className="object-cover"
      />
    </motion.div>
  );
}

function PlaceName({ text, index, count, progress }: { text: string; index: number; count: number; progress: MotionValue<number> }) {
  const k = sceneKeyframes(index, count);
  const opacity = useTransform(progress, (p) => valueAt(p, k.input, k.opacity));
  const y = useTransform(progress, (p) => valueAt(p, k.input, k.y));
  return (
    <motion.p
      style={{ opacity, y }}
      aria-hidden
      className="absolute inset-x-0 top-0 font-poster text-[clamp(4rem,9vw,8.5rem)] uppercase leading-[0.85] tracking-tight text-zinc-950 dark:text-white"
    >
      {text}
    </motion.p>
  );
}

// ── Touch / small screens / reduced motion: stacked panels ──────────────────

function StackedStory({ scenes }: { scenes: Scene[] }) {
  return (
    <section id="lookbook" aria-labelledby="nyc-lookbook-stacked" className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <Heading id="nyc-lookbook-stacked" />
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => (
          <ScenePanel key={s.id} scene={s} />
        ))}
      </ul>
    </section>
  );
}

function ScenePanel({ scene }: { scene: Scene }) {
  const locale = useLocale();
  const ref = useRef<HTMLLIElement>(null);
  const drift = useParallax(ref, 40);
  return (
    <li ref={ref} className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-zinc-900">
      <motion.div style={{ y: drift }} className="absolute inset-[-4%_0]">
        <Image
          src={scene.src}
          alt={locale === "es" ? scene.alt.es : scene.alt.en}
          fill
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
          className="object-cover"
        />
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-20">
        <p className="font-poster text-4xl uppercase leading-none text-white">{locale === "es" ? scene.place.es : scene.place.en}</p>
      </div>
      <Hotspots scene={scene} active />
    </li>
  );
}
