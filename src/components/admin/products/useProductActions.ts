"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { ResolvedVariant } from "@/lib/admin/productForm";
import { editorFeedback } from "@/lib/admin/editorErrors";
import type { EditorBanner } from "@/lib/admin/editorErrors";
import type { StockConfirmTarget } from "@/components/admin/StockConfirmDialog";
import type { AvailabilityConfirmTarget } from "@/components/admin/AvailabilityConfirmDialog";
import type { DropScheduleTarget } from "@/components/admin/DropScheduleDialog";

type DropScheduleArgs = {
  variantId: string;
  isDrop: boolean;
  dropDate?: number;
  dropBadgeTextEn?: string;
  dropBadgeTextEs?: string;
};

function bannerOf(err: unknown): EditorBanner | null {
  if (!(err instanceof ConvexError)) console.error("Product action failed", err);
  return editorFeedback(err instanceof ConvexError ? (err.data as unknown) : undefined).banner;
}

/** Quick row actions on the product list and the confirm dialogs that guard them. */
export function useProductActions(locale: string, { onDropSaved }: { onDropSaved?: (variantId: string) => void } = {}) {
  const adjustStock = useMutation(api.catalog.admin.adjustVariantStock);
  const toggleFeatured = useMutation(api.catalog.admin.toggleVariantFeatured);
  const toggleAvailable = useMutation(api.catalog.admin.toggleVariantAvailable);
  const archiveVariant = useMutation(api.catalog.admin.archiveVariant);
  const restoreVariant = useMutation(api.catalog.admin.restoreVariant);
  const updateDropStatus = useMutation(api.catalog.drops.updateVariantDropStatus);

  const [stockTarget, setStockTarget] = useState<StockConfirmTarget | null>(null);
  const [availabilityTarget, setAvailabilityTarget] = useState<AvailabilityConfirmTarget | null>(null);
  const [dropTarget, setDropTarget] = useState<DropScheduleTarget | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [skuVariantId, setSkuVariantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [flashStockId, setFlashStockId] = useState<string | null>(null);
  const [error, setError] = useState<EditorBanner | null>(null);

  const nameOf = (row: ResolvedVariant) => (locale === "es" ? row.nameEs : row.nameEn);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err: unknown) {
      setError(bannerOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const requestStock = (row: ResolvedVariant, delta: number) =>
    setStockTarget({
      variantId: row.variantId,
      name: nameOf(row),
      silhouette: row.silhouette,
      image: row.image,
      primaryHex: row.primaryHex,
      secondaryHex: row.secondaryHex,
      currentStock: row.stock,
      newStock: Math.max(0, row.stock + delta),
      delta,
    });

  const confirmStock = async () => {
    if (!stockTarget) return;
    const { variantId, delta } = stockTarget;
    setUpdatingStockId(variantId);
    const ok = await run(() => adjustStock({ variantId, delta }));
    setUpdatingStockId(null);
    setStockTarget(null);
    if (ok) {
      setFlashStockId(variantId);
      setTimeout(() => setFlashStockId(null), 1500);
    }
  };

  const requestAvailability = (row: ResolvedVariant) =>
    setAvailabilityTarget({
      variantId: row.variantId,
      name: nameOf(row),
      silhouette: row.silhouette,
      image: row.image,
      currentAvailable: row.isAvailable,
      newAvailable: !row.isAvailable,
    });

  const confirmAvailability = async () => {
    if (!availabilityTarget) return;
    const { variantId, newAvailable } = availabilityTarget;
    await run(() => toggleAvailable({ variantId, isAvailable: newAvailable }));
    setAvailabilityTarget(null);
  };

  const openDropSchedule = (row: ResolvedVariant) =>
    setDropTarget({
      variantId: row.variantId,
      name: nameOf(row),
      silhouette: row.silhouette,
      image: row.image,
      primaryHex: row.primaryHex,
      secondaryHex: row.secondaryHex,
      isDrop: Boolean(row.isDrop),
      dropDate: row.dropDate,
      dropBadgeTextEn: row.dropBadgeTextEn,
      dropBadgeTextEs: row.dropBadgeTextEs,
      subscribersCount: row.subscribersCount,
    });

  /** The dialog shows its own error, so a failure is rethrown to it. */
  const saveDropSchedule = async (args: DropScheduleArgs) => {
    setBusy(true);
    try {
      await updateDropStatus(args);
      onDropSaved?.(args.variantId);
      setDropTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveId) return;
    const variantId = archiveId;
    await run(() => archiveVariant({ variantId }));
    setArchiveId(null);
  };

  return {
    stockTarget,
    availabilityTarget,
    dropTarget,
    archiveId,
    skuVariantId,
    busy,
    updatingStockId,
    flashStockId,
    error,
    clearError: () => setError(null),
    requestStock,
    confirmStock,
    cancelStock: () => setStockTarget(null),
    requestAvailability,
    confirmAvailability,
    cancelAvailability: () => setAvailabilityTarget(null),
    toggleFeatured: (variantId: string) => void run(() => toggleFeatured({ variantId })),
    openDropSchedule,
    saveDropSchedule,
    closeDropSchedule: () => setDropTarget(null),
    requestArchive: setArchiveId,
    confirmArchive,
    cancelArchive: () => setArchiveId(null),
    restore: (variantId: string) => void run(() => restoreVariant({ variantId })),
    openSkus: setSkuVariantId,
    closeSkus: () => setSkuVariantId(null),
  };
}

export type ProductActions = ReturnType<typeof useProductActions>;
