"use client";

import { useEffect, useRef } from "react";
import { onPageRestore } from "@/lib/pageRestore";

/** Runs `onRestore` when the page is restored from the back-forward cache (see `onPageRestore`). */
export function usePageRestore(onRestore: () => void) {
  const latest = useRef(onRestore);
  latest.current = onRestore;

  useEffect(() => onPageRestore(window, () => latest.current()), []);
}
