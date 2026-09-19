"use client";

import React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminModal } from "./AdminModal";

export interface AvailabilityConfirmTarget {
  variantId: string;
  name: string;
  silhouette?: string;
  image?: string;
  currentAvailable: boolean;
  newAvailable: boolean;
}

interface AvailabilityConfirmDialogProps {
  target: AvailabilityConfirmTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
}

export default function AvailabilityConfirmDialog({
  target,
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: AvailabilityConfirmDialogProps) {
  const t = useTranslations("admin.products");

  if (!isOpen || !target) return null;

  const isHiding = !target.newAvailable;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      isProcessing={isProcessing}
      labelledBy="availability-confirm-title"
    >
      {/* Header Icon + Title */}
      <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isHiding
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isHiding ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="availability-confirm-title"
              className="font-display font-bold text-lg text-zinc-900 dark:text-white"
            >
              {isHiding ? t("confirmHideTitle") : t("confirmShowTitle")}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {isHiding
                ? t("confirmHideDesc", { name: target.name })
                : t("confirmShowDesc", { name: target.name })}
            </p>
          </div>
        </div>

        {/* Variant Summary Card */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
          <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-white/[0.04] relative shrink-0 overflow-hidden flex items-center justify-center">
            {target.image ? (
              <Image
                src={target.image}
                alt={target.name}
                fill
                sizes="48px"
                className="object-contain p-1"
              />
            ) : (
              <span className="text-[10px] font-mono font-bold text-zinc-400">0880</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">
              {target.name}
            </p>
            <p className="text-xs font-mono text-zinc-500 truncate">
              {target.variantId} • {target.silhouette || "snapback"}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                target.currentAvailable
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20"
              }`}
            >
              {target.currentAvailable ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t("available")}</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t("notAvailable")}</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Impact Alert Card */}
        <div
          className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
            isHiding
              ? "bg-amber-500/[0.08] dark:bg-amber-500/[0.06] border-amber-500/20 text-amber-800 dark:text-amber-300"
              : "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {isHiding ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>
              {isHiding
                ? "Target State: Hidden from Customers"
                : "Target State: Published on Storefront"}
            </span>
          </div>
          <p className="text-[11px] opacity-90 pl-6">
            {isHiding
              ? "This cap will immediately disappear from the homepage showcase, collection catalog, and search. Customers with direct links will see a 404 Not Found page, and existing cart items will be blocked from checkout."
              : "This cap will immediately reappear on the homepage showcase, collection catalog, and search. Direct product links will be accessible and customers will be able to purchase available stock."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t("cancelBtn")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer ${
              isHiding
                ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 active:scale-98"
                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 active:scale-98"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isHiding ? t("confirmHideBtn") : t("confirmShowBtn")}</span>
            )}
          </button>
        </div>
    </AdminModal>
  );
}
