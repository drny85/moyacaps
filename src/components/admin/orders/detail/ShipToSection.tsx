"use client";

import { useTranslations } from "next-intl";
import { Edit3, Mail, MapPin, Phone, User } from "lucide-react";
import type { OrderDetailVM } from "@/lib/admin/orderDetail";
import { Section, secondaryBtn } from "./Section";

export function ShipToSection({ shipTo, onEdit }: { shipTo: OrderDetailVM["shipTo"]; onEdit: () => void }) {
  const t = useTranslations("admin.orderDetail.shipTo");
  return (
    <Section
      title={t("title")}
      icon={<MapPin className="w-4 h-4 text-moya-red" />}
      action={shipTo.editable ? <button type="button" onClick={onEdit} className={secondaryBtn}><Edit3 className="w-3.5 h-3.5" /> {t("edit")}</button> : null}
    >
      <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
        {shipTo.name && <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"><User className="w-3.5 h-3.5 text-zinc-400" /> {shipTo.name}</p>}
        {shipTo.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-zinc-400" /> <a href={`mailto:${shipTo.email}`} className="hover:underline">{shipTo.email}</a></p>}
        {shipTo.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-zinc-400" /> {shipTo.phone}</p>}
        {shipTo.missing ? (
          <p className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">{t("missing")}</p>
        ) : (
          <address className="not-italic font-mono pt-2 space-y-0.5">{shipTo.lines.map((line, i) => <p key={i}>{line}</p>)}</address>
        )}
      </div>
    </Section>
  );
}
