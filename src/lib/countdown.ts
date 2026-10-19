export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isLive: boolean;
}

/** Time left until `target`, split for a countdown; zero and `isLive` once it has passed. */
export function timeRemaining(target: number, now: number): TimeRemaining {
  const diff = target - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isLive: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    totalMs: diff,
    isLive: false,
  };
}
