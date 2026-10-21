"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { FieldError } from "@convex/catalog/rules";

type FieldName = "flatShippingFeeUsd" | "freeShippingThresholdUnits";

const inputClass =
  "w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-moya-red";

/** Administrator-editable shipping rules. The server validates and stays authoritative. */
export function StoreSettingsCard() {
  const t = useTranslations("admin.settings.shipping");
  const tErrors = useTranslations("admin.products.errors");
  const settings = useQuery(api.settings.functions.getStoreSettings);
  const update = useMutation(api.settings.functions.updateStoreSettings);

  const [fee, setFee] = useState("");
  const [threshold, setThreshold] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setFee(String(settings.flatShippingFeeUsd));
    setThreshold(String(settings.freeShippingThresholdUnits));
  }, [settings]);

  const errorFor = (field: FieldName) => {
    const error = fieldErrors.find((e) => e.field === field);
    return error ? <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{tErrors(error.code)}</p> : null;
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors([]);
    setFormError(null);
    setSaved(false);
    // Number("") is 0, which would silently pass; empty is a required-field error instead.
    const empty = (field: FieldName, raw: string): FieldError[] =>
      raw.trim() === "" ? [{ field, code: "required" }] : [];
    const local = [...empty("flatShippingFeeUsd", fee), ...empty("freeShippingThresholdUnits", threshold)];
    if (local.length > 0) {
      setFieldErrors(local);
      return;
    }
    setSaving(true);
    try {
      await update({ flatShippingFeeUsd: Number(fee), freeShippingThresholdUnits: Number(threshold) });
      setSaved(true);
    } catch (err: unknown) {
      const data: { kind?: string; errors?: FieldError[] } | string | undefined =
        err instanceof ConvexError ? err.data : undefined;
      if (typeof data === "object" && data.kind === "validation") {
        setFieldErrors(data.errors ?? []);
      } else {
        setFormError(t("saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSave}
      className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4"
    >
      <div>
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="flat-shipping-fee" className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            {t("flatFee")}
          </label>
          <input
            id="flat-shipping-fee"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={fee}
            disabled={!settings}
            onChange={(e) => setFee(e.target.value)}
            className={inputClass}
          />
          {errorFor("flatShippingFeeUsd")}
        </div>
        <div>
          <label htmlFor="free-shipping-threshold" className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            {t("threshold")}
          </label>
          <input
            id="free-shipping-threshold"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={threshold}
            disabled={!settings}
            onChange={(e) => setThreshold(e.target.value)}
            className={inputClass}
          />
          {errorFor("freeShippingThresholdUnits")}
        </div>
      </div>

      {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !settings}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 transition-all active:scale-95 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t("save")}
        </button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-moya-green-light">
            <Check className="w-3.5 h-3.5" />
            {t("saved")}
          </span>
        )}
      </div>
    </form>
  );
}
