"use client";

import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;

export const floorToMinute = (timestamp: number) => timestamp - (timestamp % MINUTE_MS);

/**
 * Wall-clock time floored to the minute, refreshed at each minute boundary. Pass it as
 * `clientTime` to Convex queries: queries must not read the clock themselves, and equal
 * values let every component on the page share one subscription.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => floorToMinute(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(floorToMinute(Date.now()));
        schedule();
      }, MINUTE_MS - (Date.now() % MINUTE_MS));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
