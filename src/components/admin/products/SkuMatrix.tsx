"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@convex/_generated/api";
import StockConfirmDialog from "@/components/admin/StockConfirmDialog";
import { errorLine } from "@/lib/admin/editorErrors";
import type { ErrorLine } from "@/lib/admin/editorErrors";
import type { SkuMatrix as SkuMatrixVM } from "@/lib/admin/skuMatrix";
import { clampSkuStockInput } from "@/lib/admin/teeOptions";

type PendingCell = { colorway: string; colorwayName: string; size: string; current: number; next: number };

const cellKey = (colorway: string, size: string) => `${colorway}/${size}`;

/**
 * Stock per SKU (D9): Apparel Colorways × sizes. A cell edit is live Available
 * Inventory, so it saves on its own through `setTeeSkuStock` behind a confirm, apart
 * from the form's Save. Cells without a SKU yet (added in the form) wait for Save.
 */
export function SkuMatrix({ variantId, productName, matrix }: { variantId: string; productName: string; matrix: SkuMatrixVM }) {
  const t = useTranslations("admin.products.skuMatrix");
  const tProducts = useTranslations("admin.products");
  const setTeeSkuStock = useMutation(api.catalog.admin.setTeeSkuStock);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingCell | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorLine | null>(null);

  const clearDraft = (key: string) =>
    setDraft((d) => {
      const { [key]: _, ...rest } = d;
      return rest;
    });

  /** Blur or Enter: ask to save a changed cell. */
  const commitCell = (colorway: string, colorwayName: string, size: string, current: number) => {
    const key = cellKey(colorway, size);
    const raw = draft[key];
    if (raw === undefined) return;
    const next = clampSkuStockInput(raw);
    if (next === current) return clearDraft(key);
    setPending({ colorway, colorwayName, size, current, next });
  };

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      await setTeeSkuStock({ variantId, colorway: pending.colorway, size: pending.size, stock: pending.next });
      clearDraft(cellKey(pending.colorway, pending.size));
    } catch (err: unknown) {
      setError(errorLine(err));
    } finally {
      setSaving(false);
      setPending(null);
    }
  };

  const cancel = () => {
    if (pending) clearDraft(cellKey(pending.colorway, pending.size));
    setPending(null);
  };

  if (matrix.rows.length === 0 || matrix.sizes.length === 0) return <p className="text-[11px] text-zinc-500">{t("empty")}</p>;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="text-xs border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left font-medium text-zinc-500 pr-2">{t("colorway")}</th>
              {matrix.sizes.map((size) => (
                <th key={size} className={`font-mono font-semibold text-zinc-700 dark:text-zinc-300 ${matrix.removedSizes.includes(size) ? "line-through opacity-60" : ""}`}>
                  {size}
                </th>
              ))}
              <th className="font-medium text-zinc-500 pl-2">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.colorway}>
                <th scope="row" className={`text-left font-medium text-zinc-800 dark:text-zinc-200 pr-2 whitespace-nowrap ${row.removed ? "line-through opacity-60" : ""}`}>
                  {row.name}
                </th>
                {row.cells.map((cell) => {
                  const key = cellKey(row.colorway, cell.size);
                  const label = t("cellLabel", { colorway: row.name, size: cell.size });
                  return (
                    <td key={cell.size}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={label}
                        title={!cell.saved ? t("saveToAdd") : cell.blocked ? t("blocked") : undefined}
                        disabled={!cell.saved || cell.removed || saving}
                        value={draft[key] ?? String(cell.stock)}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        onBlur={() => commitCell(row.colorway, row.name, cell.size, cell.stock)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          commitCell(row.colorway, row.name, cell.size, cell.stock);
                        }}
                        className={`w-14 py-1.5 px-2 rounded-lg border text-center font-mono disabled:opacity-50 ${
                          cell.blocked
                            ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500"
                            : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] text-zinc-900 dark:text-white"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="pl-2 font-mono font-bold text-zinc-700 dark:text-zinc-300">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500">{t("hint", { total: matrix.total })}</p>
      {error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {"text" in error ? error.text : tProducts(error.key, error.values)}
        </p>
      )}

      <StockConfirmDialog
        target={
          pending
            ? {
                variantId,
                name: `${productName} · ${pending.colorwayName} / ${pending.size}`,
                currentStock: pending.current,
                newStock: pending.next,
                delta: pending.next - pending.current,
              }
            : null
        }
        isOpen={pending !== null}
        onClose={cancel}
        onConfirm={confirm}
        isProcessing={saving}
      />
    </div>
  );
}
