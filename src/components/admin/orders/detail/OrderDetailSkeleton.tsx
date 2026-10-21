const pulse = "rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse";

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className={`h-8 w-56 ${pulse}`} />
      <div className={`h-24 ${pulse}`} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6"><div className={`h-64 ${pulse}`} /><div className={`h-40 ${pulse}`} /></div>
        <div className="lg:col-span-2 space-y-6"><div className={`h-40 ${pulse}`} /><div className={`h-40 ${pulse}`} /></div>
      </div>
    </div>
  );
}
