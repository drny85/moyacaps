const pulse = "bg-zinc-100 dark:bg-white/[0.04] animate-pulse rounded-2xl";

/** Loading state of Home: strip, tiles, chart and two lists. */
export function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={`h-16 ${pulse}`} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className={`h-28 ${pulse}`} />)}
      </div>
      <div className={`h-64 ${pulse}`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`h-72 ${pulse}`} />
        <div className={`h-72 ${pulse}`} />
      </div>
    </div>
  );
}
