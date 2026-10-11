"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { use3DStage } from "@/hooks/use3DStage";

const CapStage = dynamic(() => import("./CapStage"), { ssr: false });

/**
 * Mounts the shared WebGL canvas once the browser is idle, so the poster
 * image stays the LCP element and three.js never competes with first paint.
 */
export function CapStageMount() {
  const enabled = use3DStage();
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setIsIdle(true), { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setIsIdle(true), 300);
    return () => clearTimeout(id);
  }, [enabled]);

  return enabled && isIdle ? <CapStage /> : null;
}
