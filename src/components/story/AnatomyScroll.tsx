"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  m,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";
import { useMotionPrefs } from "@/hooks/useMotionPrefs";
import { useParallax } from "@/hooks/useParallax";
import { DURATION, EASE, SPRING, STAGGER } from "@/lib/motion";

/** One entry per craft detail, each shown with the real photo of that angle */
const STEPS = [
  { key: "front", title: "layer1Title", desc: "layer1Desc", image: "/caps/angles/front.png" },
  { key: "flanks", title: "layer2Title", desc: "layer2Desc", image: "/caps/angles/left.png" },
  { key: "back", title: "layer3Title", desc: "layer3Desc", image: "/caps/angles/back.png" },
  { key: "structure", title: "layer4Title", desc: "layer4Desc", image: "/caps/negro-rojo.png" },
] as const;

const STOPS = STEPS.length;
/** Scroll span over which one photo hands off to the next */
const FADE = 0.03;

/** Close-up framing per photo: where the zoom lands (the embroidery) and how far */
const ZOOMS = [
  { src: "/caps/angles/front.png", origin: "50% 40%", zoom: 1.55 }, // horseshoe + clover
  { src: "/caps/angles/left.png", origin: "36% 48%", zoom: 1.5 }, // devil with pitchfork
  { src: "/caps/angles/back.png", origin: "50% 42%", zoom: 1.35 }, // 0880 arch + snap
];

/** Final step: all four real angles fan out around the stage */
const FAN = [
  { src: "/caps/angles/front.png", x: "-26%", y: "-20%", rotate: -5 },
  { src: "/caps/angles/left.png", x: "26%", y: "-20%", rotate: 5 },
  { src: "/caps/angles/back.png", x: "-26%", y: "22%", rotate: 4 },
  { src: "/caps/angles/right.png", x: "26%", y: "22%", rotate: -4 },
];

function SectionHeader() {
  const t = useTranslations("anatomy");
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-moya-red">{t("eyebrow")}</p>
      <h2 className="mt-2 font-poster text-4xl uppercase leading-[0.95] text-zinc-950 dark:text-white sm:text-6xl">
        {t("title")}
      </h2>
    </div>
  );
}

function StepLabel({ index }: { index: number }) {
  const t = useTranslations("anatomy");
  return (
    <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
      {String(index + 1).padStart(2, "0")} — {t(`steps.${STEPS[index].key}`)}
    </p>
  );
}

function RailSegment({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const fill = useTransform(progress, [index / STOPS, (index + 1) / STOPS], ["0%", "100%"]);
  return (
    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <m.div className="h-full bg-moya-red" style={{ width: fill }} />
    </div>
  );
}

/** One real photo: fades/turns in at its step, then pushes in on the embroidery */
function ZoomLayer({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const { src, origin, zoom } = ZOOMS[index];
  const start = index / STOPS;
  const end = (index + 1) / STOPS;
  const first = index === 0;

  const opacity = useTransform(
    progress,
    first ? [end - FADE, end + FADE] : [start - FADE, start + FADE, end - FADE, end + FADE],
    first ? [1, 0] : [0, 1, 1, 0]
  );
  // Swing in from the side like the cap turning, then swing out the other way.
  const rotateY = useTransform(
    progress,
    first ? [end - FADE, end + FADE] : [start - FADE, start + FADE, end - FADE, end + FADE],
    first ? [0, -35] : [35, 0, 0, -35]
  );
  const scale = useTransform(progress, [start + FADE, end - FADE], [1, zoom]);

  return (
    <m.div
      style={{ opacity, rotateY, scale, transformOrigin: origin }}
      className="absolute inset-0"
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 1024px) 90vw, 60vw"
        className="object-contain"
      />
    </m.div>
  );
}

function FanCard({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const card = FAN[index];
  const from = 0.75 + index * 0.015;
  const to = 0.88 + index * 0.015;
  const x = useTransform(progress, [from, to], ["0%", card.x]);
  const y = useTransform(progress, [from, to], ["0%", card.y]);
  const rotate = useTransform(progress, [from, to], [0, card.rotate]);
  const scale = useTransform(progress, [from, to], [0.9, 0.5]);
  const opacity = useTransform(progress, [0.75 - FADE, 0.75 + FADE], [0, 1]);

  return (
    <m.div
      style={{ x, y, rotate, scale, opacity }}
      className="absolute inset-0"
    >
      <Image
        src={card.src}
        alt=""
        fill
        sizes="(max-width: 1024px) 50vw, 30vw"
        className="object-contain"
      />
    </m.div>
  );
}

/** The real product photos, choreographed by scroll progress */
function PhotoStage({ progress, className }: { progress: MotionValue<number>; className?: string }) {
  const smooth = useSpring(progress, SPRING.scroll);
  return (
    <div aria-hidden className={`relative [perspective:1200px] ${className ?? ""}`}>
      <div className="pointer-events-none absolute inset-x-[15%] bottom-[6%] h-[18%] rounded-full bg-moya-red/25 blur-[70px]" />
      {ZOOMS.map((_, i) => (
        <ZoomLayer key={i} progress={smooth} index={i} />
      ))}
      {FAN.map((_, i) => (
        <FanCard key={i} progress={smooth} index={i} />
      ))}
    </div>
  );
}

/** Pinned scroll walkthrough: real photos turn and zoom to each craft detail */
function AnatomyScene() {
  const t = useTranslations("anatomy");
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(STEPS.length - 1, Math.floor(p * STOPS));
    setStep((prev) => (prev === next ? prev : next));
  });

  return (
    <section id="anatomy" ref={sectionRef} className="relative h-[400vh] border-y border-black/[0.06] dark:border-white/[0.06]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-4 pb-6 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <SectionHeader />

          <div className="grid flex-1 grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-10">
            <PhotoStage
              className="order-1 h-[42svh] w-full lg:order-2 lg:col-span-7 lg:h-[62svh]"
              progress={scrollYProgress}
            />

            <div className="order-2 min-h-[150px] lg:order-1 lg:col-span-5" aria-live="polite">
              <AnimatePresence mode="wait">
                <m.div
                  key={step}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: DURATION.fast, ease: EASE.out }}
                >
                  <StepLabel index={step} />
                  <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
                    {t(STEPS[step].title)}
                  </h3>
                  <p className="mt-2 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
                    {t(STEPS[step].desc)}
                  </p>
                </m.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-4 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <RailSegment key={s.key} progress={scrollYProgress} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One craft detail as a card; its photo drifts gently as the card crosses the viewport. */
function AnatomyPanel({ index }: { index: number }) {
  const t = useTranslations("anatomy");
  const step = STEPS[index];
  const ref = useRef<HTMLElement>(null);
  const y = useParallax(ref, 36);
  return (
    <article ref={ref} className="h-full rounded-2xl border border-black/[0.08] p-4 dark:border-white/[0.08]">
      <div className="relative mb-4 aspect-square overflow-hidden drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)]">
        <m.div style={{ y }} className="absolute inset-0">
          <Image
            src={step.image}
            alt={t(step.title)}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
            className="object-contain"
          />
        </m.div>
      </div>
      <StepLabel index={index} />
      <h3 className="mt-1.5 font-display text-xl font-bold text-zinc-950 dark:text-white">{t(step.title)}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t(step.desc)}</p>
    </article>
  );
}

/** Touch screens, small screens and reduced motion: stacked cards, no pinning (ADR 0016). */
function AnatomyPanels() {
  return (
    <section id="anatomy" className="border-y border-black/[0.06] px-4 py-16 dark:border-white/[0.06] sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.key} delay={i * STAGGER}>
              <AnatomyPanel index={i} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The pinned, scroll-scrubbed walkthrough runs only with a mouse or trackpad on a desktop-width
 * screen; everywhere else (and on first render, so SSR and hydration agree) it is stacked cards.
 */
export function AnatomyScroll() {
  const { allowPinned } = useMotionPrefs();
  return allowPinned ? <AnatomyScene /> : <AnatomyPanels />;
}
