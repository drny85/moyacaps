"use client";

import { useTranslations } from "next-intl";
import { StoreSettingsCard } from "@/components/admin/StoreSettingsCard";
import { CategoryLaunchCard } from "@/components/admin/CategoryLaunchCard";
import { AccountCard } from "./AccountCard";
import { AlertsCard } from "./AlertsCard";

/** Admin Settings (plan 0009 D19): shipping rules, category launch, alerts, account. */
export function SettingsPage() {
  const t = useTranslations("admin.settings");
  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("title")}</h1>
      <StoreSettingsCard />
      <CategoryLaunchCard />
      <AlertsCard />
      <AccountCard />
    </div>
  );
}
