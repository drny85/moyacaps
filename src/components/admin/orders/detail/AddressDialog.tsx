"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/** Edit the recipient and address until a label exists. ⌘S submits the form (HTML validation included). */
export function AddressDialog({ open, initial, busy, error, onSave, onClose }: {
  open: boolean;
  initial: AddressForm;
  busy: boolean;
  error: string | null;
  onSave: (form: AddressForm) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("admin.orderDetail.shipTo");
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<AddressForm>(initial);
  // Reset only when the dialog opens: a reactive re-render must not wipe what is being typed.
  useEffect(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AdminModal isOpen={open} onClose={onClose} isProcessing={busy} labelledBy={titleId} maxWidthClass="max-w-lg">
      <h2 id={titleId} className="font-display font-bold text-base text-zinc-950 dark:text-white">{t("dialogTitle")}</h2>
      <form
        ref={formRef}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave(form)) onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        {FIELDS.map((f) => (
          <label key={f.key} className={`text-xs font-medium text-zinc-700 dark:text-zinc-300 ${f.wide ? "col-span-2" : ""}`}>
            {t(f.key)}
            <input type={f.type ?? "text"} required={f.required} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
        ))}
        {error && <p role="alert" className="col-span-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">{t("cancel")}</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("save")}</button>
        </div>
      </form>
    </AdminModal>
  );
}
