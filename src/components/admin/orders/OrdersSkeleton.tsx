/** Loading state of the Orders list: chip row and card outlines. */
export function OrdersSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 max-w-3xl xl:max-w-6xl" aria-hidden>
      <div className="h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
      <div className="h-7 w-2/3 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14]">
          <div className="p-3.5 space-y-2">
            <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
