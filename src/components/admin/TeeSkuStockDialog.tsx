"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Check, Loader2, X } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";

interface TeeSkuStockDialogProps {
  variantId: string | null;
  onClose: () => void;
}

const key = (colorway: string, size: string) => `${colorway}/${size}`;

/**
 * Tee stock editor (ADR 0015): one cell per Apparel Colorway × size. The tee's total
 * stock is the sum of these cells and is never edited directly.
 */
export function TeeSkuStockDialog({ variantId, onClose }: TeeSkuStockDialogProps) {
  const product = useQuery(
    api.products.getProductBySlug,
    variantId ? { slug: variantId, allowUnavailable: true } : "skip"
  );
  const setSkuStock = useMutation(api.products.setTeeSkuStock);

  const saved = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of product?.skus ?? []) map[key(s.colorway, s.size)] = s.stock;
    return map;
  }, [product?.skus]);

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({});
    setError(null);
  }, [variantId]);

  const value = (k: string) => draft[k] ?? saved[k] ?? 0;
  const changed = Object.entries(draft).filter(([k, v]) => v !== (saved[k] ?? 0));
  const total = (product?.colorways ?? []).reduce(
    (sum, c) => sum + (product?.sizes ?? []).reduce((s, size) => s + value(key(c.id, size)), 0),
    0
  );

  const handleSave = async () => {
    if (!variantId || changed.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      for (const [k, stock] of changed) {
        const [colorway, size] = k.split("/");
        await setSkuStock({ variantId, colorway, size, stock });
      }
      setDraft({});
    } catch (err: any) {
      setError(err?.data || err?.message || "Failed to save stock");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminModal isOpen={Boolean(variantId)} onClose={onClose} isProcessing={isSaving} labelledBy="tee-sku-title" maxWidthClass="max-w-2xl">
      <div className="relative w-full rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="tee-sku-title" className="font-display font-bold text-lg text-zinc-900 dark:text-white pr-8">
          {product?.nameEn ?? "Tee"} — stock by colorway & size
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Total stock is the sum of these cells. Total: <span className="font-mono font-bold">{total}</span>
        </p>

        {product === undefined ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : !product?.colorways?.length || !product.sizes?.length ? (
          <p className="py-6 text-sm text-zinc-600 dark:text-zinc-400">
            This tee has no colorways or sizes yet. Run the catalog migration first.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="text-left py-2 pr-3 font-semibold">Colorway</th>
                  {product.sizes.map((size) => (
                    <th key={size} className="py-2 px-1 font-semibold">{size}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.colorways.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-100 dark:border-white/[0.06]">
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-zinc-800 dark:text-zinc-200">
                        <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: c.hex, borderColor: c.borderHex }} />
                        {c.nameEn}
                      </span>
                    </td>
                    {product.sizes!.map((size) => {
                      const k = key(c.id, size);
                      const dirty = draft[k] !== undefined && draft[k] !== (saved[k] ?? 0);
                      return (
                        <td key={size} className="py-2 px-1">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`${c.nameEn} ${size} stock`}
                            value={value(k)}
                            onChange={(e) => setDraft((d) => ({ ...d, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                            className={`w-16 py-1.5 px-2 rounded-lg font-mono text-center bg-zinc-50 dark:bg-white/[0.03] border focus:outline-none focus:ring-1 focus:ring-moya-red ${
                              dirty ? "border-amber-500" : "border-zinc-200 dark:border-white/10"
                            } ${value(k) === 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft({})}
            disabled={isSaving || changed.length === 0}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || changed.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-moya-red text-white text-sm font-bold disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save {changed.length > 0 ? `${changed.length} change${changed.length > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
