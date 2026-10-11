"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { CAP_VARIANTS } from "@/data/caps";
import { use3DStage } from "@/hooks/use3DStage";
import { Reveal } from "@/components/motion/Reveal";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

const AnatomyCapView = dynamic(() => import("@/components/three/AnatomyCapView"), { ssr: false });

const FLAGSHIP = CAP_VARIANTS[0];

/** One entry per craft detail; order matches ANATOMY_KEYFRAMES stops */
const STEPS = [
  { key: "front", title: "layer1Title", desc: "layer1Desc", image: "/caps/angles/front.png" },
  { key: "flanks", title: "layer2Title", desc: "layer2Desc", image: "/caps/angles/left.png" },
  { key: "back", title: "layer3Title", desc: "layer3Desc", image: "/caps/angles/back.png" },
  { key: "structure", title: "layer4Title", desc: "layer4Desc", image: "/caps/negro-rojo.png" },
] as const;

/** Keyframe stops in the 3D path (the final "reassembled" stop reuses the last step's copy) */
const STOPS = STEPS.length;

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
      <motion.div className="h-full bg-moya-red" style={{ width: fill }} />
    </div>
  );
}

/** Pinned scroll walkthrough: the 3D cap turns to each craft detail */
function AnatomyScene() {
  const t = useTranslations("anatomy");
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(STEPS.length - 1, Math.round(p * STOPS));
    setStep((prev) => (prev === next ? prev : next));
  });

  return (
    <section id="anatomy" ref={sectionRef} className="relative h-[420vh] border-y border-black/[0.06] dark:border-white/[0.06]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-4 pb-6 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <SectionHeader />

          <div className="grid flex-1 grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-10">
            <AnatomyCapView
              className="order-1 h-[42svh] w-full lg:order-2 lg:col-span-7 lg:h-[62svh]"
              progress={scrollYProgress}
              primaryHex={FLAGSHIP.primaryHex}
              secondaryHex={FLAGSHIP.secondaryHex}
            />

            <div className="order-2 min-h-[150px] lg:order-1 lg:col-span-5" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
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
                </motion.div>
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

/** Static version: no WebGL, no model yet, or reduced motion */
function AnatomyPanels() {
  const t = useTranslations("anatomy");
  return (
    <section id="anatomy" className="border-y border-black/[0.06] px-4 py-16 dark:border-white/[0.06] sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.key} delay={i * STAGGER}>
              <article className="h-full rounded-2xl border border-black/[0.08] p-4 dark:border-white/[0.08]">
                <div className="relative mb-4 aspect-square">
                  <Image
                    src={s.image}
                    alt={t(s.title)}
                    fill
                    sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
                    className="object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)]"
                  />
                </div>
                <StepLabel index={i} />
                <h3 className="mt-1.5 font-display text-xl font-bold text-zinc-950 dark:text-white">{t(s.title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t(s.desc)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AnatomyScroll() {
  const show3D = use3DStage();
  const reduceMotion = useReducedMotion();
  return show3D && !reduceMotion ? <AnatomyScene /> : <AnatomyPanels />;
}
