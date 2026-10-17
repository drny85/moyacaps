"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  m,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";
import { frameIndexForProgress } from "@/lib/heroMotion";
import { DURATION, EASE, SPRING } from "@/lib/motion";
import { whenIdle } from "@/lib/deferred";

export interface TurntableFrame {
  src: string;
  label: string;
}

/** Pixels of horizontal drag that turn the cap by one photo */
const DRAG_STEP_PX = 70;
/** Auto-turn interval until the visitor interacts */
const AUTO_TURN_MS = 2800;

/**
 * A real-photo turntable (remount it with a new `key` to swap frame sets). Each frame is a product photo from a different
 * angle; dragging (or arrow keys) turns the cap between them, with a
 * directional rotate so the swap reads as the cap spinning. Pointer tilt,
 * a moving sheen and a ground shadow add depth without any 3D model.
 * With `scrub`, page scroll turns the cap (see heroMotion) until the visitor turns it by hand.
 */
export function CapTurntable({
  frames,
  alt,
  glowHex,
  className = "",
  priority = false,
  onInteract,
  onFrameChange,
  scrub,
  showAngleDots = true,
}: {
  frames: TurntableFrame[];
  alt: string;
  /** Colorway hex for the soft glow under the cap */
  glowHex: string;
  className?: string;
  priority?: boolean;
  onInteract?: () => void;
  /** Called with the index of the photo on show whenever it changes */
  onFrameChange?: (index: number) => void;
  /** 0..1 scroll progress that turns the cap instead of the idle auto-turn */
  scrub?: MotionValue<number>;
  /** The angle dots under the cap (off when the parent shows the angle another way) */
  showAngleDots?: boolean;
}) {
  const reduceMotion = useReducedMotionSafe();
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "-20% 0px" });
  const [index, setIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const canTurn = frames.length > 1;
  // A priority (hero) turntable paints only its front photo first, so the hidden angles do
  // not compete with the LCP image for bandwidth; the rest load once the page is idle or
  // the visitor reaches for the cap.
  const [anglesReady, setAnglesReady] = useState(!priority);
  const loadAngles = useCallback(() => setAnglesReady(true), []);
  useEffect(() => {
    if (anglesReady) return;
    return whenIdle(loadAngles);
  }, [anglesReady, loadAngles]);

  // ── Turning ──
  const turn = useCallback(
    (step: number) => setIndex((i) => (i + step + frames.length) % frames.length),
    [frames.length]
  );

  const markInteracted = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteract?.();
    }
  }, [hasInteracted, onInteract]);

  useEffect(() => {
    if (!canTurn || !anglesReady || hasInteracted || reduceMotion || !inView || scrub) return;
    const id = setInterval(() => turn(1), AUTO_TURN_MS);
    return () => clearInterval(id);
  }, [canTurn, anglesReady, hasInteracted, reduceMotion, inView, turn, scrub]);

  // Scroll-driven turn: the hero's scroll progress picks the photo until the visitor takes over.
  const idleScrub = useMotionValue(0);
  useMotionValueEvent(scrub ?? idleScrub, "change", (p) => {
    if (!scrub || !canTurn || hasInteracted || reduceMotion) return;
    loadAngles();
    setIndex(frameIndexForProgress(p, frames.length));
  });

  useEffect(() => {
    onFrameChange?.(index);
  }, [index, onFrameChange]);

  const drag = useRef<{ x: number; carried: number } | null>(null);

  // ── Tilt + sheen (mouse only) ──
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-9, 9]), SPRING.tilt);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [7, -7]), SPRING.tilt);
  const sheenX = useTransform(pointerX, (v) => `${v * 100}%`);
  const sheenY = useTransform(pointerY, (v) => `${v * 100}%`);
  const sheen = useMotionTemplate`radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.22), transparent 45%)`;
  const shadowX = useTransform(rotateY, [-9, 9], ["-6%", "6%"]);
  const shadowScale = useTransform(rotateX, [-7, 7], [1.08, 0.92]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canTurn) return;
    loadAngles();
    drag.current = { x: e.clientX, carried: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && !reduceMotion) {
      const rect = e.currentTarget.getBoundingClientRect();
      pointerX.set((e.clientX - rect.left) / rect.width);
      pointerY.set((e.clientY - rect.top) / rect.height);
    }
    const d = drag.current;
    if (!d) return;
    d.carried += e.clientX - d.x;
    d.x = e.clientX;
    // Dragging right swings the front away to the right, revealing the next angle.
    while (Math.abs(d.carried) >= DRAG_STEP_PX) {
      const step = Math.sign(d.carried);
      turn(step);
      d.carried -= step * DRAG_STEP_PX;
      markInteracted();
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onPointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canTurn) return;
    loadAngles();
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      turn(e.key === "ArrowRight" ? 1 : -1);
      markInteracted();
    }
  };

  /** Where frame i sits relative to the active one: 0 active, 1 next, -1 previous */
  const relative = (i: number) => {
    const n = frames.length;
    const r = (i - index + n) % n;
    return r === 0 ? 0 : r === 1 ? 1 : r === n - 1 ? -1 : 2;
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={stageRef}
        role={canTurn ? "slider" : "img"}
        aria-label={canTurn ? `${alt} — ${frames[index].label}` : alt}
        aria-valuemin={canTurn ? 1 : undefined}
        aria-valuemax={canTurn ? frames.length : undefined}
        aria-valuenow={canTurn ? index + 1 : undefined}
        aria-valuetext={canTurn ? frames[index].label : undefined}
        tabIndex={canTurn ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onPointerEnter={loadAngles}
        onFocus={loadAngles}
        className={`relative h-full w-full select-none [perspective:1100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red/60 rounded-3xl ${
          canTurn ? "cursor-grab touch-pan-y active:cursor-grabbing" : ""
        }`}
      >
        {/* Colorway glow + ground shadow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-60"
          style={{ background: `radial-gradient(closest-side, ${glowHex}, transparent)` }}
        />
        <m.div
          aria-hidden
          style={{ x: shadowX, scaleX: shadowScale }}
          className="pointer-events-none absolute inset-x-[18%] bottom-[9%] h-[7%] rounded-[50%] bg-black/35 blur-xl dark:bg-black/70"
        />

        {/* Floating, tilting photo stack. The drop-in is CSS (globals.css .intro-drop): it plays
            from the first paint without waiting for JavaScript, and the photo is never hidden,
            so it counts as the LCP immediately. */}
        <div className="intro-drop absolute inset-0">
          <m.div
            // Idle bob only while on screen: no work for a hero scrolled out of view
            animate={reduceMotion || !inView ? { y: 0 } : { y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <m.div style={{ rotateX, rotateY }} className="absolute inset-0 [transform-style:preserve-3d]">
              {frames.map((frame, i) => {
                const rel = relative(i);
                if (!anglesReady && i !== index) return null;
                return (
                  <m.div
                    key={frame.src}
                    aria-hidden={rel !== 0}
                    initial={false}
                    animate={{
                      opacity: rel === 0 ? 1 : 0,
                      // The next angle waits on the left so a rightward drag swings it into view.
                      rotateY: rel === 0 ? 0 : rel === 1 ? -55 : rel === -1 ? 55 : 0,
                      x: rel === 0 ? "0%" : rel === 1 ? "-14%" : rel === -1 ? "14%" : "0%",
                      scale: rel === 0 ? 1 : 0.9,
                    }}
                    transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
                    className="absolute inset-[6%]"
                  >
                    <Image
                      src={frame.src}
                      alt={rel === 0 ? `${alt} — ${frame.label}` : ""}
                      fill
                      priority={priority && i === 0}
                      fetchPriority={priority && i === 0 ? "high" : undefined}
                      sizes="(max-width: 1024px) 90vw, 640px"
                      draggable={false}
                      className="object-contain"
                    />
                  </m.div>
                );
              })}

              {/* Light sheen that follows the pointer */}
              {!reduceMotion && (
                <m.div
                  aria-hidden
                  style={{ background: sheen }}
                  className="pointer-events-none absolute inset-[10%] rounded-[40%] mix-blend-soft-light"
                />
              )}
            </m.div>
          </m.div>
        </div>
      </div>

      {/* Angle selector */}
      {canTurn && showAngleDots && (
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {frames.map((frame, i) => (
            <button
              key={frame.src}
              type="button"
              onClick={() => {
                loadAngles();
                setIndex(i);
                markInteracted();
              }}
              aria-label={frame.label}
              aria-pressed={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-moya-red" : "w-1.5 bg-zinc-400/60 hover:bg-zinc-500 dark:bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
