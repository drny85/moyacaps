"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Check, Flame, Plus, RotateCw, X } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DropScheduleDialog } from "@/components/admin/DropScheduleDialog";
import type { DropScheduleTarget } from "@/components/admin/DropScheduleDialog";
import { QueryErrorBoundary } from "@/components/admin/QueryErrorBoundary";
import { EmptyState } from "@/components/admin/products/EmptyState";
import { dropMetrics, schedulableProducts, scheduleStartDate, toDropCard } from "@/lib/admin/dropCard";
import type { DropCardVM, DropRowInput } from "@/lib/admin/dropCard";
import { DeleteDropDialog } from "./DeleteDropDialog";
import { DropCard } from "./DropCard";
import { DropCardsSkeleton } from "./DropCardsSkeleton";
import { DropMetrics } from "./DropMetrics";
import { SubscribersTable } from "./SubscribersTable";
import { useDrops } from "./useDrops";
import { useTicker } from "./useTicker";

type Dialog = { kind: "schedule"; target: DropScheduleTarget } | { kind: "release" | "cancel" | "delete"; card: DropCardVM } | null;

type TargetRow = Pick<DropRowInput, "variantId" | "nameEn" | "nameEs" | "silhouette" | "image" | "catalogShot" | "dropDate" | "dropBadgeTextEn" | "dropBadgeTextEs" | "subscribersCount">;

/** The dialog starts enabled; a date in the past (a live drop's release time) gives way to its default. */
function toTarget(row: TargetRow, locale: "en" | "es", now: number): DropScheduleTarget {
  return {
    variantId: row.variantId,
    name: locale === "es" ? row.nameEs : row.nameEn,
    silhouette: row.silhouette,
    image: row.catalogShot || row.image,
    isDrop: true,
    dropDate: scheduleStartDate(row.dropDate, now),
    dropBadgeTextEn: row.dropBadgeTextEn,
    dropBadgeTextEs: row.dropBadgeTextEs,
    subscribersCount: row.subscribersCount,
  };
}

function DropsBody() {
  const t = useTranslations("admin.drops");
  const tCommon = useTranslations("admin.common");
  const locale = useLocale() as "en" | "es";
  const { drops, catalog, subscribers, busy, error, success, dismissError, actions } = useDrops();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pick, setPick] = useState("");
  const close = () => {
    setDialog(null);
    dismissError();
  };

  const metrics = useMemo(() => (drops ? dropMetrics(drops, Date.now()) : null), [drops]);
  const now = useTicker(Boolean(metrics && (metrics.scheduled > 0)));
  const cards = useMemo(() => drops?.map((row) => toDropCard(row, locale, now)), [drops, locale, now]);
  const byId = useMemo(() => new Map(drops?.map((row) => [row.variantId, row])), [drops]);
  const schedulable = useMemo(() => schedulableProducts(catalog?.variants ?? []), [catalog]);

  const openSchedule = (variantId: string) => {
    const row = byId.get(variantId) ?? schedulable.find((p) => p.variantId === variantId);
    if (!row) return;
    setPick("");
    setDialog({ kind: "schedule", target: toTarget(row, locale, Date.now()) });
  };

  return (
    <div className="space-y-6">
      {error && dialog === null && (
        <p role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</span>
          <button type="button" onClick={dismissError} aria-label={tCommon("dismiss")} className="p-1 rounded hover:bg-rose-500/20"><X className="w-3.5 h-3.5" /></button>
        </p>
      )}
      {success && <p role="status" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300"><Check className="w-4 h-4" /> {success}</p>}

      {metrics ? <DropMetrics metrics={metrics} now={now} /> : <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("activeTitle")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pick) openSchedule(pick);
            }}
            className="flex items-center gap-2"
          >
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("pickProduct")} className="py-2 px-3 text-xs rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white max-w-[14rem]">
              <option value="">{schedulable.length === 0 ? t("noneToSchedule") : t("pickProduct")}</option>
              {schedulable.map((p) => <option key={p.variantId} value={p.variantId}>{locale === "es" ? p.nameEs : p.nameEn}</option>)}
            </select>
            <button type="submit" disabled={!pick || busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 disabled:opacity-50">
              <Plus className="w-4 h-4" /> {t("scheduleDrop")}
            </button>
          </form>
        </div>
        {!cards ? (
          <DropCardsSkeleton />
        ) : cards.length === 0 ? (
          <EmptyState icon={<Flame className="w-8 h-8" />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((card) => (
              <DropCard
                key={card.variantId}
                vm={card}
                busy={busy}
                onRelease={() => setDialog({ kind: "release", card })}
                onReschedule={() => openSchedule(card.variantId)}
                onCancel={() => setDialog({ kind: "cancel", card })}
                onDelete={() => setDialog({ kind: "delete", card })}
              />
            ))}
          </div>
        )}
      </section>

      <SubscribersTable subscribers={subscribers} />

      <DropScheduleDialog
        target={dialog?.kind === "schedule" ? dialog.target : null}
        isOpen={dialog?.kind === "schedule"}
        onClose={close}
        onSave={(args) => actions.schedule(args, byId.has(args.variantId))}
        isProcessing={busy}
      />
      <ConfirmDialog
        open={dialog?.kind === "release"}
        title={t("release.title", { name: dialog?.kind === "release" ? dialog.card.name : "" })}
        body={t("release.body")}
        confirmLabel={t("release.confirm")}
        busy={busy}
        error={error}
        onClose={close}
        onConfirm={async () => {
          if (dialog?.kind === "release" && (await actions.release(dialog.card.variantId))) close();
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "cancel"}
        title={t("cancel.title", { name: dialog?.kind === "cancel" ? dialog.card.name : "" })}
        body={t("cancel.body")}
        confirmLabel={t("cancel.confirm")}
        destructive
        busy={busy}
        error={error}
        onClose={close}
        onConfirm={async () => {
          if (dialog?.kind === "cancel" && (await actions.cancel(dialog.card.variantId))) close();
        }}
      />
      <DeleteDropDialog
        open={dialog?.kind === "delete"}
        name={dialog?.kind === "delete" ? dialog.card.name : ""}
        busy={busy}
        error={error}
        onClose={close}
        onConfirm={(deleteSubscribers) => (dialog?.kind === "delete" ? actions.remove(dialog.card.variantId, deleteSubscribers) : Promise.resolve(false))}
      />
    </div>
  );
}

/** Admin Drops (plan 0009 Screen 6): scheduled and live Drops as cards, and who asked to be told. */
export function DropsPage() {
  const t = useTranslations("admin");
  return (
    <div className="space-y-5 pb-24 sm:pb-12">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("drops.title")}</h1>
      <QueryErrorBoundary
        fallback={(retry) => (
          <EmptyState title={t("common.queryFailed")}>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </EmptyState>
        )}
      >
        <DropsBody />
      </QueryErrorBoundary>
    </div>
  );
}
