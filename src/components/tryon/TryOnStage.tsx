"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { applyDrag, applyPinch, pinchDelta, type CapAnchor, type CapPlacement, type FitAdjust, type Point } from "@/lib/tryOn/fit";

/**
 * Head and shoulders drawn around `SILHOUETTE_FACE` (eyes y 0.54, ears x 0.33–0.67), so the
 * default placement sits on it the way a fitted cap sits on a photo.
 */
function HeadSilhouette() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="tryon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e7e3" />
          <stop offset="1" stopColor="#d9d6d0" />
        </linearGradient>
        <linearGradient id="tryon-figure" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b5ae" />
          <stop offset="1" stopColor="#a39e96" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#tryon-bg)" />
      <g fill="url(#tryon-figure)">
        <path d="M14 100c2-15 12-22 25-25l5-2v-9h12v9l5 2c13 3 23 10 25 25z" />
        <ellipse cx="50" cy="52" rx="17" ry="22" />
        <ellipse cx="32.5" cy="57" rx="2.6" ry="5" />
        <ellipse cx="67.5" cy="57" rx="2.6" ry="5" />
      </g>
    </svg>
  );
}

interface Props {
  photoUrl: string | null;
  overlay: string;
  label: string;
  handleLabel: string;
  anchor: CapAnchor;
  placement: CapPlacement;
  onAdjust: (update: (prev: FitAdjust) => FitAdjust) => void;
  /** Covers the stage (camera preview); the cap is hidden while it shows */
  cover?: React.ReactNode;
  status?: React.ReactNode;
}

/** The square Try-On stage: the photo (or a silhouette) with the cap on it, moved by drag, pinch, wheel or keys */
export function TryOnStage({ photoUrl, overlay, label, handleLabel, anchor, placement, onAdjust, cover, status }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());

  const toStage = (e: PointerEvent): Point => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toStage(e));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const next = toStage(e);
    if (map.size >= 2) {
      const [a, b] = [...map.entries()].slice(0, 2);
      const from: [Point, Point] = [a[1], b[1]];
      const to: [Point, Point] = [a[0] === e.pointerId ? next : a[1], b[0] === e.pointerId ? next : b[1]];
      const { ratio, rotation } = pinchDelta(from, to);
      onAdjust((adj) => applyPinch(adj, ratio, rotation));
    } else {
      onAdjust((adj) => applyDrag(adj, anchor, next.x - prev.x, next.y - prev.y));
    }
    map.set(e.pointerId, next);
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  // Trackpad pinch (and Ctrl + wheel) arrive as wheel events with ctrlKey; a plain wheel
  // still scrolls the page. Native listener: React's wheel handlers are passive.
  const adjustRef = useRef(onAdjust);
  adjustRef.current = onAdjust;
  useEffect(() => {
    const el = stageRef.current;
    if (!el || cover) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      adjustRef.current((adj) => applyPinch(adj, Math.exp(-e.deltaY * 0.01)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cover]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      onAdjust((adj) => applyDrag(adj, anchor, dx, dy));
    } else if (e.key === "+" || e.key === "=") {
      onAdjust((adj) => applyPinch(adj, 1.04));
    } else if (e.key === "-" || e.key === "_") {
      onAdjust((adj) => applyPinch(adj, 1 / 1.04));
    } else {
      return;
    }
    e.preventDefault();
  };

  const { x, y, size, rotation } = placement;

  return (
    <div
      ref={stageRef}
      role="img"
      aria-label={label}
      className="relative aspect-square w-full select-none overflow-hidden rounded-[18px] bg-zinc-200 dark:bg-zinc-900"
    >
      {photoUrl ? (
        // An in-memory object URL: next/image has nothing to optimise
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <HeadSilhouette />
      )}

      {!cover && (
        <div
          tabIndex={0}
          role="button"
          aria-label={handleLabel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          className="absolute cursor-grab touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-moya-red active:cursor-grabbing"
          style={{
            left: `${(x - size / 2) * 100}%`,
            top: `${(y - size / 2) * 100}%`,
            width: `${size * 100}%`,
            height: `${size * 100}%`,
            transform: `rotate(${rotation}deg)`,
            filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.45))",
          }}
        >
          <Image
            src={overlay}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 30vw, 70vw"
            draggable={false}
            className="pointer-events-none object-contain"
          />
        </div>
      )}

      {cover}
      {status && <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">{status}</div>}
    </div>
  );
}
