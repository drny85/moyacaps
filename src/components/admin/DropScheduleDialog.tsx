"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Radio, Users, Bell, Trash2, Calendar, Sparkles, Check, Loader2, X } from "lucide-react";
import { AdminModal } from "./AdminModal";
import { DateTimePicker } from "./DateTimePicker";

export interface DropScheduleTarget {
  variantId: string;
  name: string;
  silhouette?: string;
  image?: string;
  primaryHex?: string;
  secondaryHex?: string;
  isDrop: boolean;
  dropDate?: number;
  dropBadgeTextEn?: string;
  dropBadgeTextEs?: string;
  subscribersCount?: number;
}

interface DropScheduleDialogProps {
  target: DropScheduleTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (args: {
    variantId: string;
    isDrop: boolean;
    dropDate?: number;
    dropBadgeTextEn?: string;
    dropBadgeTextEs?: string;
  }) => Promise<void>;
  isProcessing: boolean;
}

export function DropScheduleDialog({
  target,
  isOpen,
  onClose,
  onSave,
  isProcessing,
}: DropScheduleDialogProps) {
  const locale = useLocale();

  const [isDropActive, setIsDropActive] = useState(false);
  const [dropTimestamp, setDropTimestamp] = useState<number>(Date.now() + 86400000 * 3);
  const [badgeEn, setBadgeEn] = useState("");
  const [badgeEs, setBadgeEs] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when target opens
  useEffect(() => {
    if (target) {
      setIsDropActive(target.isDrop);
      setDropTimestamp(target.dropDate || Date.now() + 86400000 * 3);
      setBadgeEn(target.dropBadgeTextEn || "Vault Release");
      setBadgeEs(target.dropBadgeTextEs || "Lanzamiento de Bóveda");
      setErrorMsg(null);
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const handleConfirmSave = async () => {
    try {
      setErrorMsg(null);
      await onSave({
        variantId: target.variantId,
        isDrop: isDropActive,
        dropDate: isDropActive ? dropTimestamp : undefined,
        dropBadgeTextEn: badgeEn.trim() || undefined,
        dropBadgeTextEs: badgeEs.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update drop schedule.");
    }
  };

  const handleDeactivate = async () => {
    try {
      setErrorMsg(null);
      await onSave({
        variantId: target.variantId,
        isDrop: false,
        dropDate: undefined,
        dropBadgeTextEn: undefined,
        dropBadgeTextEs: undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to deactivate drop schedule.");
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      isProcessing={isProcessing}
      labelledBy="drop-schedule-modal-title"
      maxWidthClass="max-w-xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-moya-red/10 text-moya-red flex items-center justify-center shrink-0 border border-moya-red/20 shadow-xs">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-moya-red font-bold">
                VIP RADAR TELEMETRY
              </span>
              {target.isDrop && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-moya-red/15 text-moya-red border border-moya-red/30">
                  CURRENTLY ACTIVE
                </span>
              )}
            </div>
            <h3 id="drop-schedule-modal-title" className="font-display font-bold text-lg text-zinc-900 dark:text-white">
              Schedule Limited Drop
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Target Colorway Mini Preview */}
      <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 p-1 relative shrink-0">
            <Image
              src={target.image || "/caps/negro-rojo.png"}
              alt={target.name}
              fill
              className="object-contain p-0.5"
            />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white">
              {target.name}
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
              <span>slug: {target.variantId}</span>
              <span>•</span>
              <span>{target.silhouette}</span>
            </div>
          </div>
        </div>

        {/* Live Subscriber telemetry pill if previously a drop */}
        {target.subscribersCount !== undefined && target.subscribersCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold shrink-0">
            <Users className="w-3.5 h-3.5" />
            <span>{target.subscribersCount} Collectors Waiting</span>
          </div>
        )}
      </div>

      {/* Drop State Switcher */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="dropStatusToggle"
            checked={isDropActive}
            onChange={(e) => setIsDropActive(e.target.checked)}
            className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
          />
          <label htmlFor="dropStatusToggle" className="cursor-pointer">
            <span className="font-display font-bold text-xs text-zinc-900 dark:text-white block">
              Activate VIP Drop Status
            </span>
            <span className="text-[11px] text-zinc-500 block">
              Gates instant purchases and displays live ticking countdown radar.
            </span>
          </label>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
          isDropActive
            ? "bg-moya-red text-white shadow-xs"
            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        }`}>
          {isDropActive ? "ENABLED" : "DISABLED"}
        </span>
      </div>

      {/* When Active: Show DateTimePicker & Bilingual Badges */}
      {isDropActive ? (
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-display font-bold text-zinc-800 dark:text-zinc-200 block mb-2">
              Release Target & Launch Protocol
            </label>
            <DateTimePicker
              value={dropTimestamp}
              onChange={(newTime) => setDropTimestamp(newTime)}
            />
          </div>

          {/* Bilingual Drop Badge Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
            <div>
              <label className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Drop Badge Label (EN)
              </label>
              <input
                type="text"
                value={badgeEn}
                onChange={(e) => setBadgeEn(e.target.value)}
                placeholder="e.g. Vault Release 01"
                className="w-full py-1.5 px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Drop Badge Label (ES)
              </label>
              <input
                type="text"
                value={badgeEs}
                onChange={(e) => setBadgeEs(e.target.value)}
                placeholder="ej. Lanzamiento de Bóveda"
                className="w-full py-1.5 px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-zinc-100/70 dark:bg-white/[0.02] border border-dashed border-zinc-300 dark:border-white/10 text-center py-6 text-xs text-zinc-500">
          Drop mode is disabled. Toggle the checkbox above to schedule an exclusive release countdown.
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-white/[0.08]">
        {target.isDrop ? (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleDeactivate}
            className="py-2.5 px-3 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Turn Off Drop</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmSave}
            className="py-2.5 px-5 rounded-xl bg-moya-red hover:bg-rose-500 text-white text-xs font-display font-bold uppercase tracking-wider transition-all shadow-md shadow-moya-red-deep/30 disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Schedule...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Drop Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
