"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Edit2, ExternalLink, MoreHorizontal, Radio } from "lucide-react";
import { Link } from "@/i18n/routing";

const itemClass =
  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06]";

/** The card's ⋯ menu: Edit, Drop schedule, View on store, Archive or Restore. */
export function ProductCardMenu({
  variantId,
  name,
  archived,
  onDrop,
  onArchive,
  onRestore,
}: {
  variantId: string;
  name: string;
  archived: boolean;
  onDrop: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations("admin.products.card");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menu", { name })}
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-1 z-20 w-44 py-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#14141e] shadow-xl">
          {!archived && (
            <Link role="menuitem" href={`/admin/products/${variantId}`} className={itemClass}>
              <Edit2 className="w-3.5 h-3.5" /> {t("edit")}
            </Link>
          )}
          {!archived && (
            <button role="menuitem" type="button" onClick={run(onDrop)} className={itemClass}>
              <Radio className="w-3.5 h-3.5" /> {t("dropSchedule")}
            </button>
          )}
          <Link role="menuitem" href={`/products/${variantId}`} target="_blank" className={itemClass}>
            <ExternalLink className="w-3.5 h-3.5" /> {t("viewOnStore")}
          </Link>
          {archived ? (
            <button role="menuitem" type="button" onClick={run(onRestore)} className={itemClass}>
              <ArchiveRestore className="w-3.5 h-3.5" /> {t("restore")}
            </button>
          ) : (
            <button role="menuitem" type="button" onClick={run(onArchive)} className={`${itemClass} text-red-600 dark:text-red-400`}>
              <Archive className="w-3.5 h-3.5" /> {t("archive")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
