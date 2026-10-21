"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import type { AddressForm } from "./useOrderDetail";
import { inputClass, primaryBtn } from "./Section";

const FIELDS: Array<{ key: keyof AddressForm; required?: boolean; type?: string; wide?: boolean }> = [
  { key: "customerName", wide: true },
  { key: "customerEmail", type: "email" },
  { key: "customerPhone" },
  { key: "line1", required: true, wide: true },
  { key: "line2", wide: true },
  { key: "city", required: true },
  { key: "state", required: true },
  { key: "postalCode", required: true },
  { key: "country", required: true },
];

/** Edit the recipient and address until a label exists. Registers its submit for ⌘S while open. */
export function AddressDialog({ open, initial, busy, onSave, onClose, registerSubmit }: {
  open: boolean;
  initial: AddressForm;
  busy: boolean;
  onSave: (form: AddressForm) => Promise<boolean>;
  onClose: () => void;
  registerSubmit: (submit: (() => void) | null) => void;
}) {
  const t = useTranslations("admin.orderDetail.shipTo");
  const titleId = useId();
  const [form, setForm] = useState<AddressForm>(initial);
  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const submit = async () => {
    if (form.line1.trim() === "") return;
    if (await onSave(form)) onClose();
  };
  useEffect(() => {
    registerSubmit(open ? submit : null);
    return () => registerSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  return (
    <AdminModal isOpen={open} onClose={onClose} isProcessing={busy} labelledBy={titleId} maxWidthClass="max-w-lg">
      <h2 id={titleId} className="font-display font-bold text-base text-zinc-950 dark:text-white">{t("dialogTitle")}</h2>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className={`text-xs font-medium text-zinc-700 dark:text-zinc-300 ${f.wide ? "col-span-2" : ""}`}>
            {t(f.key)}
            <input type={f.type ?? "text"} required={f.required} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
        ))}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">{t("cancel")}</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("save")}</button>
        </div>
      </form>
    </AdminModal>
  );
}
