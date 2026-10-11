"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, View } from "@react-three/drei";
import { useStageStore } from "./stageStore";

const MAX_DPR = 1.75;

/**
 * The single WebGL canvas for the homepage. It is fixed over the viewport
 * (below the navbar and modals, never catching pointer events) and only
 * draws inside the rectangles of the <View>s placed in the hero and anatomy
 * sections — one context and one model load shared by both.
 */
export default function CapStage() {
  const isAnyViewVisible = useStageStore((s) => s.visibleViews > 0);
  const setQuality = useStageStore((s) => s.setQuality);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, MAX_DPR));

  return (
    <Canvas
      aria-hidden
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }}
      frameloop={isAnyViewVisible ? "always" : "never"}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setQuality("low");
        }}
        onIncline={() => setDpr(Math.min(window.devicePixelRatio || 1, MAX_DPR))}
      />
      <View.Port />
    </Canvas>
  );
}
