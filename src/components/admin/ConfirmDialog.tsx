"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";

/** The High-Friction Confirmation Safeguard (CONTEXT.md): one dialog for every irreversible move. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  /** The last failure of this dialog's action, shown where the Administrator is looking. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** An optional form (a reason, a toggle) shown between the body and the buttons. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.common");
  const titleId = useId();
  return (
    <AdminModal isOpen={open} onClose={onClose} isProcessing={busy} labelledBy={titleId} maxWidthClass="max-w-md">
      <div className="flex items-start gap-3">
        <span className={`p-2 rounded-xl shrink-0 ${destructive ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"}`}>
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="font-display font-bold text-base text-zinc-950 dark:text-white">{title}</h2>
          {body && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{body}</p>}
        </div>
      </div>
      {children}
      {error && <p role="alert" className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] disabled:opacity-50">
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-60 ${
            destructive ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" : "bg-moya-red hover:bg-moya-red-light shadow-moya-red/20"
          }`}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {confirmLabel ?? t("confirm")}
        </button>
      </div>
    </AdminModal>
  );
}
