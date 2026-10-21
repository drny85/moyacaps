"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/** Delete a Drop's configuration; its subscribers stay unless asked (the default keeps them). */
export function DeleteDropDialog({ open, name, busy, error, onConfirm, onClose }: {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  onConfirm: (deleteSubscribers: boolean) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("admin.drops.delete");
  const [alsoSubscribers, setAlsoSubscribers] = useState(false);
  useEffect(() => {
    if (open) setAlsoSubscribers(false);
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      title={t("title", { name })}
      body={t("body")}
      confirmLabel={t("confirm")}
      destructive
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={async () => {
        if (await onConfirm(alsoSubscribers)) onClose();
      }}
    >
      <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={alsoSubscribers} onChange={(e) => setAlsoSubscribers(e.target.checked)} className="mt-0.5 accent-moya-red" />
        <span>{t("alsoSubscribers")}</span>
      </label>
    </ConfirmDialog>
  );
}
