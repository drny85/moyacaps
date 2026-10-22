"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { DeferredImage } from "@/components/media/DeferredImage";
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, m, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";
import { ANATOMY_PHOTO, ANATOMY_STEPS, type AnatomyCallout, type AnatomyStep } from "@/data/anatomy";
import { useMotionPrefs } from "@/hooks/useMotionPrefs";
import { calloutLayout, edgeFadeMask, stepAt, stepRange } from "@/lib/anatomy";
import { DURATION, EASE, STAGGER, valueAt } from "@/lib/motion";

const STEPS = ANATOMY_STEPS;
const COUNT = STEPS.length;
/** Scroll span over which one photo crossfades into the next */
const FADE = 0.025;
/** The stage takes the photo's own shape so callout percentages land on the garment */
const PHOTO_ASPECT = { aspectRatio: `${ANATOMY_PHOTO.width} / ${ANATOMY_PHOTO.height}` };

function SectionHeader() {
  const t = useTranslations("anatomy");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="font-poster text-5xl uppercase leading-[0.9] text-zinc-950 dark:text-white sm:text-6xl lg:text-7xl">
        {t("title")}
      </h2>
      <p className="max-w-xs text-sm leading-snug text-zinc-500 sm:text-right">{t("subtitle")}</p>
    </div>
  );
}

/** One dot on the photo, a hairline out to the edge, and its label riding on the line */
function Callout({ callout, index, animate }: { callout: AnatomyCallout; index: number; animate: boolean }) {
  const t = useTranslations("anatomy.callouts");
  const { side, lineLeft, lineWidth } = calloutLayout(callout);
  const delay = animate ? 0.12 + index * 0.09 : 0;
  const left = side === "left";

  return (
    <>
      <m.span
        aria-hidden
        className="absolute h-2.5 w-2.5 rounded-full bg-moya-red ring-2 ring-white shadow-[0_0_0_4px_rgba(225,29,72,0.25)]"
        style={{ left: `${callout.x}%`, top: `${callout.y}%`, x: "-50%", y: "-50%" }}
        initial={animate ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: DURATION.fast, delay, ease: EASE.pop }}
      />
      <m.span
        aria-hidden
        className="absolute h-px bg-zinc-950/40 dark:bg-white/40"
        style={{ left: `${lineLeft}%`, top: `${callout.y}%`, width: `${lineWidth}%`, transformOrigin: left ? "right" : "left" }}
        initial={animate ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ duration: DURATION.base, delay: delay + 0.05, ease: EASE.out }}
      />
      <span
        className={`absolute flex max-w-[42%] -translate-y-full pb-1.5 ${left ? "justify-start" : "justify-end"}`}
        style={left ? { left: `${lineLeft}%`, top: `${callout.y}%` } : { right: `${100 - lineLeft - lineWidth}%`, top: `${callout.y}%` }}
      >
        <m.span
          className={`rounded-md bg-white/85 px-1.5 py-0.5 font-display text-[11px] font-semibold leading-tight tracking-wide text-zinc-950 backdrop-blur-sm dark:bg-zinc-950/80 dark:text-white sm:text-xs ${
            left ? "text-left" : "text-right"
          }`}
          initial={animate ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.fast, delay: delay + 0.2, ease: EASE.out }}
        >
          {t(callout.label)}
        </m.span>
      </span>
    </>
  );
}

/** The step's photo, framed edge to edge; callouts are drawn on top by the caller */
function AnglePhoto({ step, priority = false }: { step: AnatomyStep; priority?: boolean }) {
  const t = useTranslations("anatomy");
  const mask = edgeFadeMask(step.cutEdges);
  const Photo = priority ? Image : DeferredImage;
  return (
    <Photo
      src={step.image}
      alt={t(step.title)}
      fill
      priority={priority}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      sizes="(max-width: 1024px) 90vw, 55vh"
      className="object-cover"
    />
  );
}

/** One photo layer of the pinned stage: visible only during its step */
function StageLayer({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const [start, end] = stepRange(index, COUNT);
  const first = index === 0;
  const last = index === COUNT - 1;
  const input = first ? [end - FADE, end + FADE] : last ? [start - FADE, start + FADE] : [start - FADE, start + FADE, end - FADE, end + FADE];
  const output = first ? [1, 0] : last ? [0, 1] : [0, 1, 1, 0];
  // Function form keeps this on the section's own progress (see valueAt)
  const opacity = useTransform(progress, (p) => valueAt(p, input, output));
  return (
    <m.div style={{ opacity }} className="absolute inset-0">
      <AnglePhoto step={STEPS[index]} priority={first} />
    </m.div>
  );
}

/** One row of the spec sheet: number, name, the one hard spec, and a progress track while active */
function SpecRow({
  step,
  index,
  active,
  progress,
  onSelect,
}: {
  step: AnatomyStep;
  index: number;
  active: boolean;
  progress: MotionValue<number>;
  onSelect?: (index: number) => void;
}) {
  const t = useTranslations("anatomy");
  const [start, end] = stepRange(index, COUNT);
  const fill = useTransform(progress, (p) => `${valueAt(p, [start, end], [0, 100])}%`);
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      type={onSelect ? "button" : undefined}
      onClick={onSelect ? () => onSelect(index) : undefined}
      aria-current={active ? "step" : undefined}
      className={`group relative w-full border-t border-black/10 py-4 text-left transition-opacity duration-300 dark:border-white/10 ${
        active ? "opacity-100" : "opacity-40 hover:opacity-70"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red`}
    >
      <span aria-hidden className="absolute -top-px left-0 h-px w-full overflow-hidden">
        <m.span className="block h-full bg-moya-red" style={{ width: active ? fill : "0%" }} />
      </span>
      <span className="flex items-baseline gap-4">
        <span className="w-6 shrink-0 font-display text-xs tabular-nums text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
        <span className="flex-1 font-display text-lg font-bold tracking-tight text-zinc-950 dark:text-white sm:text-xl">
          {t(step.title)}
        </span>
        <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-moya-red">{t(step.spec)}</span>
      </span>
      <AnimatePresence initial={false}>
        {active && (
          <m.p
            key="desc"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE.out }}
            className="overflow-hidden pl-10 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            <span className="block pt-2">{t(step.desc)}</span>
          </m.p>
        )}
      </AnimatePresence>
    </Tag>
  );
}

/** The four steps as tabs: the active one lit, the rest clickable to jump */
function StepStrip({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  const t = useTranslations("anatomy");
  return (
    <div className="flex gap-2" role="tablist" aria-label={t("angles")}>
      {STEPS.map((step, i) => (
        <button
          key={step.key}
          type="button"
          role="tab"
          aria-selected={active === i}
          onClick={() => onSelect(i)}
          className={`rounded-full border px-3 py-1.5 font-display text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
            active === i
              ? "border-moya-red bg-moya-red/10 text-moya-red"
              : "border-black/10 text-zinc-500 hover:text-zinc-900 dark:border-white/10 dark:hover:text-white"
          }`}
        >
          {t(`steps.${step.key}`)}
        </button>
      ))}
    </div>
  );
}

/** Scroll the window so the pinned scene sits on step `index` (just inside its range) */
function scrollToStep(section: HTMLElement, index: number) {
  const top = section.getBoundingClientRect().top + window.scrollY;
  const span = section.offsetHeight - window.innerHeight;
  const [start] = stepRange(index, COUNT);
  const y = top + span * (start + 0.02);
  const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number) => void } }).__lenis;
  if (lenis) lenis.scrollTo(y);
  else window.scrollTo({ top: y, behavior: "smooth" });
}

/** Pinned scroll walkthrough: the tee stays put while each craft detail is called out in turn */
function AnatomyScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = stepAt(p, COUNT);
    setStep((prev) => (prev === next ? prev : next));
  });

  const select = useCallback((index: number) => {
    if (sectionRef.current) scrollToStep(sectionRef.current, index);
  }, []);

  return (
    <section id="anatomy" ref={sectionRef} className="relative h-[400vh] border-y border-black/[0.06] dark:border-white/[0.06]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-4 pb-6 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <SectionHeader />

          <div className="grid flex-1 grid-cols-12 items-center gap-10">
            <div className="col-span-5">
              <div className="border-b border-black/10 dark:border-white/10">
                {STEPS.map((s, i) => (
                  <SpecRow key={s.key} step={s} index={i} active={step === i} progress={scrollYProgress} onSelect={select} />
                ))}
              </div>
            </div>

            <div className="col-span-7 flex justify-center">
              <div
                className="relative h-[62svh] max-w-full overflow-hidden rounded-3xl text-zinc-950 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)] dark:text-white"
                style={PHOTO_ASPECT}
              >
                {STEPS.map((_, i) => (
                  <StageLayer key={STEPS[i].key} progress={scrollYProgress} index={i} />
                ))}
                <div className="absolute inset-0" aria-hidden>
                  <AnimatePresence mode="wait">
                    <m.div key={step} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                      {STEPS[step].callouts.map((c, i) => (
                        <Callout key={c.label} callout={c} index={i} animate />
                      ))}
                    </m.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <StepStrip active={step} onSelect={select} />
            <p className="font-display text-xs tabular-nums text-zinc-500">
              {String(step + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One step with its callouts drawn in, and the spec row under it */
function AnatomyPanel({ step, index }: { step: AnatomyStep; index: number }) {
  const t = useTranslations("anatomy");
  return (
    <article>
      <div className="relative w-full overflow-hidden rounded-3xl text-zinc-950 dark:text-white" style={PHOTO_ASPECT}>
        <AnglePhoto step={step} />
        <div className="absolute inset-0" aria-hidden>
          {step.callouts.map((c, i) => (
            <Callout key={c.label} callout={c} index={i} animate={false} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-3 border-t border-black/10 pt-4 dark:border-white/10">
        <span className="font-display text-xs tabular-nums text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="flex-1 font-display text-lg font-bold tracking-tight text-zinc-950 dark:text-white">{t(step.title)}</h3>
        <span className="font-display text-sm font-semibold tabular-nums text-moya-red">{t(step.spec)}</span>
      </div>
      <p className="mt-1.5 pl-7 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t(step.desc)}</p>
    </article>
  );
}

/** Touch screens, small screens and reduced motion: one step after another, no pinning (ADR 0016). */
function AnatomyPanels() {
  return (
    <section id="anatomy" className="border-y border-black/[0.06] px-4 py-16 dark:border-white/[0.06] sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader />
        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <Reveal key={s.key} delay={i * STAGGER}>
              <AnatomyPanel step={s} index={i} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The pinned, scroll-scrubbed walkthrough runs only with a mouse or trackpad on a desktop-width
 * screen; everywhere else (and on first render, so SSR and hydration agree) it is stacked panels.
 */
export function AnatomyScroll() {
  const { allowPinned } = useMotionPrefs();
  return allowPinned ? <AnatomyScene /> : <AnatomyPanels />;
}
