"use client";

import { useTranslations, useLocale } from "next-intl";
import { Flame, Clover } from "lucide-react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { DURATION, EASE } from "@/lib/motion";

/** Splits "38,000+" into prefix / number / suffix so the number can count up */
function parseStat(value: string) {
  const match = value.match(/^(\D*)([\d][\d,.]*)(.*)$/);
  if (!match) return null;
  const number = Number(match[2].replace(/,/g, ""));
  return Number.isFinite(number) ? { prefix: match[1], number, suffix: match[3] } : null;
}

/** Stat whose numeric part counts up from zero when scrolled into view */
function AnimatedStat({ value, label, description, delay = 0 }: {
  value: string;
  label: string;
  description: string;
  delay?: number;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const parsed = parseStat(value);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView || !parsed) return;
    if (reduceMotion) {
      setCount(parsed.number);
      return;
    }
    const controls = animate(0, parsed.number, {
      duration: 1.6,
      delay,
      ease: EASE.out,
      onUpdate: (v) => setCount(Math.round(v)),
    });
    return () => controls.stop();
  }, [isInView, parsed?.number, delay, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: DURATION.base, delay, ease: EASE.out }}
      className="border-b border-black/[0.08] dark:border-white/[0.08] pb-6 last:border-b-0 last:pb-0"
    >
      <div className="font-poster text-5xl sm:text-6xl uppercase text-moya-red tabular-nums">
        {parsed ? `${parsed.prefix}${count.toLocaleString(locale === "es" ? "es-MX" : "en-US")}${parsed.suffix}` : value}
      </div>
      <div className="text-sm font-display font-semibold text-zinc-800 dark:text-zinc-200 mt-1.5 uppercase tracking-wider">
        {label}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

function ScrollWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.25em]">
      {word}
    </motion.span>
  );
}

/** Headline whose words light up one by one as it scrolls through the viewport */
function ScrollHeadline({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.35"] });
  const words = text.split(" ");

  return (
    <h2
      ref={ref}
      className="font-poster uppercase text-4xl sm:text-6xl lg:text-7xl tracking-tight text-zinc-950 dark:text-white mb-6 sm:mb-8 leading-[0.95]"
    >
      {reduceMotion
        ? text
        : words.map((word, i) => (
            <ScrollWord
              key={`${word}-${i}`}
              word={word}
              progress={scrollYProgress}
              range={[i / words.length, (i + 1) / words.length]}
            />
          ))}
    </h2>
  );
}

export function BrandStory() {
  const t = useTranslations("story");

  return (
    <section
      id="story"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-black/[0.06] dark:border-white/[0.04] relative overflow-hidden bg-[#f4f4f8] dark:bg-[#050508] transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ── Left: Editorial Narrative ── */}
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-moya-red mb-3">
              {t("eyebrow")}
            </p>

            <ScrollHeadline text={t("title")} />

            <Reveal>
              <p className="text-zinc-700 dark:text-zinc-300 text-base sm:text-lg leading-relaxed mb-5 font-sans">
                {t("part1")}
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed mb-10 font-sans">
                {t("part2")}
              </p>
            </Reveal>

            {/* ── Pillars ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Clover, tint: "text-moya-green", title: t("pillarFortuneTitle"), desc: t("pillarFortuneDesc") },
                { icon: Flame, tint: "text-moya-red", title: t("pillarAudacityTitle"), desc: t("pillarAudacityDesc") },
              ].map(({ icon: Icon, tint, title, desc }, i) => (
                <Reveal key={title} delay={0.15 + i * 0.08}>
                  <div className="h-full p-5 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] flex items-start gap-3">
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${tint}`} />
                    <div>
                      <h4 className="font-display font-bold text-base text-zinc-900 dark:text-white">{title}</h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* ── Right: Stats Card with Animated Counters ── */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl p-8 sm:p-10 border border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex flex-col gap-6">
                <AnimatedStat
                  value={t("stat1Value")}
                  label={t("stat1Label")}
                  description={t("stat1Desc")}
                  delay={0.1}
                />
                <AnimatedStat
                  value={t("stat2Value")}
                  label={t("stat2Label")}
                  description={t("stat2Desc")}
                  delay={0.3}
                />
                <AnimatedStat
                  value={t("stat3Value")}
                  label={t("stat3Label")}
                  description={t("stat3Desc")}
                  delay={0.5}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
