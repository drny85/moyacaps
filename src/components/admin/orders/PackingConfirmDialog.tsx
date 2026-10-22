"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/** Buying a label before the Packing Checklist is complete asks first (plan 0012); it never blocks. */
export function PackingConfirmDialog({ open, uncheckedUnits, totalUnits, onConfirm, onClose }: {
  open: boolean;
  uncheckedUnits: number;
  totalUnits: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("admin.packingConfirm");
  return (
    <ConfirmDialog
      open={open}
      title={t("title")}
      body={uncheckedUnits > 0 ? t("unchecked", { count: uncheckedUnits, total: totalUnits }) : t("overflow")}
      confirmLabel={t("confirm")}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
