"use client";

import React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, Loader2, PackageMinus, PackagePlus } from "lucide-react";
import { AdminModal } from "./AdminModal";

export interface StockConfirmTarget {
  variantId: string;
  name: string;
  silhouette?: string;
  image?: string;
  primaryHex?: string;
  secondaryHex?: string;
  currentStock: number;
  newStock: number;
  delta: number;
}

interface StockConfirmDialogProps {
  target: StockConfirmTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
}

export default function StockConfirmDialog({
  target,
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: StockConfirmDialogProps) {
  const t = useTranslations("admin.products");

  if (!isOpen || !target) return null;

  const isAdding = target.delta > 0;
  const isZero = target.newStock === 0;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      isProcessing={isProcessing}
      labelledBy="stock-confirm-title"
    >
      {/* Header Icon + Title */}
      <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isZero
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : isAdding
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {isZero ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isAdding ? (
              <PackagePlus className="w-5 h-5" />
            ) : (
              <PackageMinus className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="stock-confirm-title"
              className="font-display font-bold text-lg text-zinc-900 dark:text-white"
            >
              {t("confirmStockTitle")}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t("confirmStockDesc")}
            </p>
          </div>
        </div>

        {/* Variant Summary Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
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
              <span className="font-mono text-xs text-zinc-400">0880</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                {target.name}
              </span>
              {target.silhouette && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-200/60 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400">
                  {target.silhouette}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {target.variantId}
              </span>
              {target.primaryHex && (
                <div className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20"
                    style={{ backgroundColor: target.primaryHex }}
                  />
                  {target.secondaryHex && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: target.secondaryHex }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Before/After Visual Metric */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
              {t("currentStock")}
            </span>
            <span className="font-mono text-base font-bold text-zinc-700 dark:text-zinc-300">
              {target.currentStock}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
              {t("stockAdjustment")}
            </span>
            <span
              className={`font-mono text-base font-bold flex items-center gap-1 ${
                isAdding
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isAdding ? `+${target.delta}` : target.delta}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isZero
                ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <span className="text-[10px] font-mono uppercase block mb-1 opacity-80">
              {t("projectedStock")}
            </span>
            <span className="font-mono text-base font-bold">
              {target.newStock}
            </span>
          </div>
        </div>

        {/* "What is about to happen" Impact Explanation */}
        <div
          className={`p-3.5 rounded-xl text-xs space-y-1 ${
            isZero
              ? "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
              : isAdding
              ? "bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 border border-emerald-500/15"
              : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
          }`}
        >
          <div className="font-semibold flex items-center gap-1.5">
            <span>What is about to happen:</span>
          </div>
          <p className="leading-relaxed">
            {isZero
              ? t("stockImpactZero")
              : isAdding
              ? t("stockImpactAdd", {
                  delta: target.delta,
                  current: target.currentStock,
                  projected: target.newStock,
                })
              : t("stockImpactDeduct", {
                  delta: Math.abs(target.delta),
                  current: target.currentStock,
                  projected: target.newStock,
                })}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {t("cancelBtn")}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 ${
              isZero
                ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                : isAdding
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                : "bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-black/20"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>{t("confirmStockBtn")}</span>
            )}
          </button>
        </div>
    </AdminModal>
  );
}
