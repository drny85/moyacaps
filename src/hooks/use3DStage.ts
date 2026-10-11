"use client";

import { useEffect, useState } from "react";
import { getCapModelSource } from "@/components/three/capModelConfig";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function isLowPowerDevice() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return true;
  return typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4;
}

/**
 * Whether the homepage should mount the WebGL cap stage. False on the server,
 * on first client render, without WebGL, on low-power / data-saver devices,
 * and when no cap model is available — callers keep the photo poster then.
 */
export function use3DStage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getCapModelSource() !== "none" && hasWebGL() && !isLowPowerDevice());
  }, []);

  return enabled;
}
