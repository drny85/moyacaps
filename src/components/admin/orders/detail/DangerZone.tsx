"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { Section } from "./Section";

export function DangerZone({ onCancel }: { onCancel: () => void }) {
  const t = useTranslations("admin.orderDetail.danger");
  return (
    <Section title={t("title")} icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("help")}</p>
      <button type="button" onClick={onCancel} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">{t("cancel")}</button>
    </Section>
  );
}
