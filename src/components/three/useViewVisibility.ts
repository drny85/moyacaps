"use client";

import { useEffect, type RefObject } from "react";
import { useInView } from "framer-motion";
import { useStageStore } from "./stageStore";

/** Tracks a View's on-screen state and reports it to the shared canvas */
export function useViewVisibility(ref: RefObject<HTMLElement | null>) {
  const inView = useInView(ref as RefObject<HTMLElement>, { margin: "120px 0px" });
  const setVisible = useStageStore((s) => s.setVisible);

  useEffect(() => {
    if (!inView) return;
    setVisible(1);
    return () => setVisible(-1);
  }, [inView, setVisible]);

  return inView;
}
