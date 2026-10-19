import React from "react";

/** A centred message with an optional action: empty catalog, no results, query error. */
export function EmptyState({ icon, title, body, children }: { icon?: React.ReactNode; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10 bg-white/60 dark:bg-white/[0.02]">
      {icon && <div className="text-zinc-400">{icon}</div>}
      <p className="font-display font-bold text-zinc-900 dark:text-white">{title}</p>
      {body && <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm">{body}</p>}
      {children && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{children}</div>}
    </div>
  );
}
