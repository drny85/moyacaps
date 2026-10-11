"use client";

import { useLocale } from "next-intl";
import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "framer-motion";
import { useCapVariants } from "@/hooks/useCapVariants";
import { SPRING } from "@/lib/motion";

/** Base drift in % of one copy's width per second */
const BASE_SPEED = 2.2;

/**
 * Infinite band of colorway names between the drops and the catalog.
 * Scrolling speeds it up and skews it in the scroll direction.
 */
export function ColorwayMarquee() {
  const locale = useLocale();
  const { caps } = useCapVariants();
  const reduceMotion = useReducedMotion();

  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), SPRING.velocity);
  const speedBoost = useTransform(velocity, [-2000, 0, 2000], [-4, 0, 4], { clamp: false });
  const skewX = useTransform(velocity, [-2000, 2000], [8, -8]);

  const offset = useMotionValue(0);
  const x = useTransform(offset, (v) => `${wrap(-50, 0, v)}%`);
  const direction = useRef(-1);

  useAnimationFrame((_, delta) => {
    if (reduceMotion) return;
    const boost = speedBoost.get();
    if (boost > 0.2) direction.current = -1;
    else if (boost < -0.2) direction.current = 1;
    const step = direction.current * BASE_SPEED * (delta / 1000) * (1 + Math.abs(boost));
    offset.set(offset.get() + step);
  });

  const items = caps.map((cap) => (
    <span key={cap.id} className="flex shrink-0 items-center gap-4 pr-10">
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-black/10 dark:border-white/20 sm:h-7 sm:w-7"
        style={{ background: `linear-gradient(135deg, ${cap.primaryHex} 50%, ${cap.secondaryHex} 50%)` }}
      />
      <span>{locale === "es" ? cap.nameEs : cap.nameEn}</span>
    </span>
  ));

  return (
    <div
      aria-hidden
      className="relative overflow-hidden border-y border-black/[0.06] py-5 dark:border-white/[0.06] sm:py-7"
    >
      <motion.div
        className="flex w-max whitespace-nowrap font-poster text-3xl uppercase text-zinc-900 dark:text-white sm:text-5xl"
        style={reduceMotion ? undefined : { x, skewX }}
      >
        <div className="flex">{items}</div>
        <div className="flex">{items}</div>
      </motion.div>
    </div>
  );
}
