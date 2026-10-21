"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronRight, Package } from "lucide-react";
import type { PackingLine } from "@/lib/admin/orderDetail";
import { Section } from "./Section";

/** The lines to pack (D13a): Catalog Shot, name, Colorway · size, slug, quantity in large type. Tap for the Packing sheet. */
export function ItemsSection({ items, itemCount, onOpen }: { items: PackingLine[]; itemCount: number; onOpen: (line: PackingLine) => void }) {
  const t = useTranslations("admin.orderDetail.items");
  return (
    <Section title={t("title")} icon={<Package className="w-4 h-4 text-moya-red" />} action={<span className="text-[11px] font-mono text-zinc-500">{t("units", { count: itemCount })}</span>}>
      <ul className="divide-y divide-zinc-100 dark:divide-white/[0.04] -mx-2">
        {items.map((line) => (
          <li key={line.key}>
            <button type="button" onClick={() => onOpen(line)} className="w-full flex items-center gap-3.5 px-2 py-3 text-left rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors">
              <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 shrink-0">
                {line.image ? <Image src={line.image} alt="" fill sizes="64px" className="object-cover" /> : <Package className="w-6 h-6 m-auto text-zinc-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{line.name}</p>
                {line.colorway && <p className="text-xs text-zinc-700 dark:text-zinc-300">{line.colorway}{line.size ? ` · ${line.size}` : ""}</p>}
                <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{line.slug}</p>
                <p className="text-[11px] font-mono text-zinc-500">{line.lineLabel}{line.quantity > 1 ? ` · ${t("each", { price: line.unitLabel })}` : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-2xl font-display font-bold text-zinc-950 dark:text-white tabular-nums">×{line.quantity}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-500">{t("tapHint")}</p>
    </Section>
  );
}
