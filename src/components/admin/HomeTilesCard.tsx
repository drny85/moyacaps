"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useLocale, useTranslations } from "next-intl";
import { Check, ImageOff, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import type { FunctionReturnType } from "convex/server";

type Row = FunctionReturnType<typeof api.catalog.admin.getAllProductsAdmin>["variants"][number];

const CATEGORIES: Category[] = ["headwear", "apparel"];

const inputClass =
  "w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red disabled:opacity-60";

function categoryOf(row: Pick<Row, "category" | "silhouette">): Category {
  if (row.category === "apparel" || row.category === "headwear") return row.category;
  return row.silhouette === "tee" ? "apparel" : "headwear";
}

/** The image a tile shows for a Product: its Catalog Shot, or its default colorway's for a tee. */
function tileImage(row: Row): string | undefined {
  const colorway = row.colorways?.find((c) => c.id === row.defaultColorway) ?? row.colorways?.[0];
  return colorway?.catalogShot || row.catalogShot || row.image || undefined;
}

/** Which Product the homepage Caps and Tees tiles show (Admin → Settings). */
export function HomeTilesCard() {
  const t = useTranslations("admin.homeTiles");
  const picks = useQuery(api.settings.homeTiles.getHomeTiles, {});
  const admin = useQuery(api.catalog.admin.getAllProductsAdmin, {});

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => (
          <HomeTileRow
            key={category}
            category={category}
            picked={picks?.[category]}
            rows={(admin?.variants ?? []).filter((r) => r.archivedAt === undefined && categoryOf(r) === category)}
            loading={picks === undefined || admin === undefined}
          />
        ))}
      </div>
    </section>
  );
}

function HomeTileRow({ category, picked, rows, loading }: { category: Category; picked?: string; rows: Row[]; loading: boolean }) {
  const t = useTranslations("admin.homeTiles");
  const locale = useLocale();
  const save = useMutation(api.settings.homeTiles.setHomeTile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const nameOf = (r: Row) => (locale === "es" ? r.nameEs : r.nameEn) || r.variantId;
  const sorted = [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const current = rows.find((r) => r.variantId === picked);
  const image = current ? tileImage(current) : undefined;

  const choose = async (variantId: string) => {
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      await save({ category, variantId });
      setSaved(true);
    } catch (err) {
      if (!(err instanceof ConvexError)) console.error("Failed to set the homepage tile", err);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-zinc-200 dark:border-white/10">
      <div className="relative w-16 aspect-[4/5] shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-white/5">
        {image ? (
          <Image src={image} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <ImageOff className="absolute inset-0 m-auto w-5 h-5 text-zinc-400" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-xs">
        <label className="block font-medium text-zinc-700 dark:text-zinc-300">
          {t(`label.${category}`)}
          <select
            value={current ? current.variantId : ""}
            disabled={loading || saving || sorted.length === 0}
            onChange={(e) => void choose(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {!current && <option value="">{loading ? t("loading") : t("automatic")}</option>}
            {sorted.map((r) => (
              <option key={r.variantId} value={r.variantId}>
                {nameOf(r)}
                {r.isAvailable ? "" : ` · ${t("hidden")}`}
              </option>
            ))}
          </select>
        </label>
        <p role="status" aria-live="polite" className="min-h-4 text-[11px]">
          {saving && (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> {t("saving")}
            </span>
          )}
          {saved && !saving && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="w-3 h-3" aria-hidden /> {t("saved")}
            </span>
          )}
          {error && <span className="text-red-600 dark:text-red-400">{t("error")}</span>}
          {!saving && !saved && !error && !current && !loading && <span className="text-zinc-500">{t("fallbackHint")}</span>}
        </p>
      </div>
    </div>
  );
}
