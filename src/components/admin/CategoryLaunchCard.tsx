"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Category, FieldError } from "@convex/catalog/rules";
import type { CategoryLaunch, CategoryStatus } from "@convex/settings/launch";
import { AdminModal } from "@/components/admin/AdminModal";
import { DateTimePicker } from "@/components/admin/DateTimePicker";
import { listedCount, needsLaunchConfirm } from "@/lib/admin/categoryLaunch";

const CATEGORIES: Category[] = ["headwear", "apparel"];
const STATUSES: CategoryStatus[] = ["live", "coming_soon", "hidden"];
const HEADLINE_MAX = 80;
const DEFAULT_LAUNCH_OFFSET_MS = 3 * 24 * 60 * 60 * 1000;

const inputClass =
  "w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red";

/** Category Status controls (ADR 0022): Live, Coming soon (teaser) or Hidden, per category. */
export function CategoryLaunchCard() {
  const t = useTranslations("admin.launch");
  const launches = useQuery(api.settings.functions.getStorefrontLaunch);
  const admin = useQuery(api.catalog.admin.getAllProductsAdmin, {});

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => (
          <CategoryLaunchRow
            key={category}
            category={category}
            launch={launches?.[category]}
            listed={admin ? listedCount(admin.variants, category) : 0}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryLaunchRow({ category, launch, listed }: { category: Category; launch?: CategoryLaunch; listed: number }) {
  const t = useTranslations("admin.launch");
  const tErrors = useTranslations("admin.products.errors");
  const save = useMutation(api.settings.functions.setCategoryLaunch);

  const [status, setStatus] = useState<CategoryStatus>("live");
  const [launchAt, setLaunchAt] = useState<number | undefined>(undefined);
  const [headlineEn, setHeadlineEn] = useState("");
  const [headlineEs, setHeadlineEs] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!launch) return;
    setStatus(launch.status);
    setLaunchAt(launch.launchAt);
    setHeadlineEn(launch.headlineEn ?? "");
    setHeadlineEs(launch.headlineEs ?? "");
  }, [launch]);

  const isComingSoon = status === "coming_soon";
  const errorFor = (field: string) => {
    const error = fieldErrors.find((e) => e.field === field);
    return error ? <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{tErrors(error.code)}</p> : null;
  };

  const submit = async () => {
    setFieldErrors([]);
    setFormError(null);
    setSaved(false);
    setSaving(true);
    try {
      await save({
        category,
        status,
        launchAt: isComingSoon ? launchAt : undefined,
        headlineEn: isComingSoon ? headlineEn : undefined,
        headlineEs: isComingSoon ? headlineEs : undefined,
      });
      setSaved(true);
      setConfirming(false);
    } catch (err: unknown) {
      const data: { kind?: string; errors?: FieldError[] } | string | undefined =
        err instanceof ConvexError ? err.data : undefined;
      if (typeof data === "object" && data.kind === "validation") setFieldErrors(data.errors ?? []);
      else setFormError(t("saveFailed"));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (launch && needsLaunchConfirm(launch.status, status)) setConfirming(true);
    else void submit();
  };

  const name = t(`category.${category}`);

  return (
    <form onSubmit={onSave} className="rounded-xl border border-zinc-200 dark:border-white/10 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{name}</h3>
        {launch && <span className="text-[11px] text-zinc-500">{t(`statusNow.${launch.status}`)}</span>}
      </div>

      <div role="radiogroup" aria-label={t("statusLabel", { name })} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04]">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            disabled={!launch}
            onClick={() => {
              setStatus(s);
              setSaved(false);
            }}
            className={`py-2 rounded-lg font-semibold transition-colors ${
              status === s
                ? "bg-white dark:bg-white/10 text-zinc-950 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {t(`status.${s}`)}
          </button>
        ))}
      </div>
      <p className="text-zinc-500 dark:text-zinc-400">{t(`statusHelp.${status}`)}</p>

      {isComingSoon && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={launchAt !== undefined}
              onChange={(e) => setLaunchAt(e.target.checked ? Date.now() + DEFAULT_LAUNCH_OFFSET_MS : undefined)}
            />
            {t("scheduleLaunch")}
          </label>
          {launchAt !== undefined && (
            <div>
              <DateTimePicker value={launchAt} onChange={setLaunchAt} />
              <p className="mt-1 text-zinc-500">{t("launchAtHelp", { name })}</p>
              {errorFor("launchAt")}
            </div>
          )}
          {(["headlineEn", "headlineEs"] as const).map((field) => {
            const value = field === "headlineEn" ? headlineEn : headlineEs;
            const setValue = field === "headlineEn" ? setHeadlineEn : setHeadlineEs;
            return (
              <div key={field}>
                <label htmlFor={`${category}-${field}`} className="font-medium text-zinc-700 dark:text-zinc-300 flex justify-between mb-1">
                  <span>{t(field)}</span>
                  <span className={value.trim().length > HEADLINE_MAX ? "text-red-600" : "text-zinc-400"}>
                    {value.trim().length}/{HEADLINE_MAX}
                  </span>
                </label>
                <input
                  id={`${category}-${field}`}
                  value={value}
                  placeholder={t(`headlinePlaceholder.${category}.${field}`)}
                  onChange={(e) => setValue(e.target.value)}
                  className={inputClass}
                />
                {errorFor(field)}
              </div>
            );
          })}
        </div>
      )}

      {formError && <p className="text-red-600 dark:text-red-400">{formError}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!launch || saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t("save", { name })}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            {t("saved")}
          </span>
        )}
      </div>

      <AdminModal isOpen={confirming} onClose={() => setConfirming(false)} isProcessing={saving} labelledBy={`${category}-launch-confirm`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id={`${category}-launch-confirm`} className="font-display font-bold text-lg text-zinc-900 dark:text-white">
              {t("confirmTitle", { name, status: t(`status.${status}`) })}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{t("confirmBody", { count: listed })}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-semibold"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("confirm")}
          </button>
        </div>
      </AdminModal>
    </form>
  );
}
