const TONES = {
  default: "bg-white dark:bg-[#0c0c14] border-zinc-200 dark:border-white/[0.06]",
  // Actions that cannot be undone (the Danger Zone).
  danger: "bg-rose-50/60 dark:bg-rose-500/[0.04] border-rose-300 dark:border-rose-500/30",
};

/** One card of the detail page: a title row and its body. */
export function Section({
  id,
  title,
  icon,
  action,
  tone = "default",
  children,
}: {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${TONES[tone]} border rounded-2xl p-5 shadow-xs space-y-4 scroll-mt-20`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white flex items-center gap-2">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const inputClass =
  "w-full py-2 px-3 text-sm rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red";
export const primaryBtn =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-60";
export const secondaryBtn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-zinc-50 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50";
