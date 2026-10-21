export function DropCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14]">
          <div className="aspect-[4/5] bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
