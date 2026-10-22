"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Check, RotateCw, Search, SearchX, Truck, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useRouter } from "@/i18n/routing";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { ORDERS_LIMIT, effectiveSince, hasActiveFilters, legacyOrderParamHref, rangeApplies } from "@/lib/admin/orderFilters";
import { toOrderRow } from "@/lib/admin/orderRow";
import type { OrderRowVM } from "@/lib/admin/orderRow";
import { QueryErrorBoundary } from "@/components/admin/QueryErrorBoundary";
import { ShippingLabelModal } from "@/components/admin/ShippingLabelModal";
import { EmptyState } from "@/components/admin/products/EmptyState";
import { useAdminShortcuts } from "@/components/admin/products/useAdminShortcuts";
import { OrderRow } from "./OrderRow";
import { OrdersSkeleton } from "./OrdersSkeleton";
import { HandoffDialog } from "./HandoffDialog";
import { PickupCard } from "./PickupCard";
import { QueueChips } from "./QueueChips";
import { RangeChips } from "./RangeChips";
import { useOrderFilters } from "./useOrderFilters";

type OrderDoc = NonNullable<ReturnType<typeof useQuery<typeof api.orders.desk.getAllOrdersAdmin>>>[number];
/** A snapshot: once a label is bought the Order leaves this queue, but the modal must stay up to print. */
type LabelTarget = { order: OrderDoc; reship: boolean } | null;

function ListBody() {
  const t = useTranslations("admin.orders");
  const tCommon = useTranslations("admin.common");
  const locale = useLocale() as "en" | "es";
  const { filters, setFilters, clear } = useOrderFilters();
  const clientTime = useMinuteClock();
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const searchRef = useRef<HTMLInputElement>(null);
  useAdminShortcuts({ "/": () => searchRef.current?.focus() });

  const orders = useQuery(api.orders.desk.getAllOrdersAdmin, {
    clientTime,
    status: filters.queue,
    search: filters.q,
    since: effectiveSince(filters, clientTime, tzOffsetMinutes),
    limit: ORDERS_LIMIT,
  });
  const attention = useQuery(api.orders.desk.getOrdersAttentionStats, { clientTime });
  const handoffs = useQuery(api.orders.handoffs.handoffAttention, { clientTime });
  const [bulkHandoff, setBulkHandoff] = useState(false);

  const rows = useMemo(() => orders?.map((o) => toOrderRow(o, clientTime, locale)), [orders, clientTime, locale]);
  // The modal needs the full Order document, not the row.
  const byId = useMemo(() => new Map(orders?.map((o) => [o._id as string, o])), [orders]);
  const openLabel = (row: OrderRowVM) => {
    const order = byId.get(row.id);
    if (order) setLabel({ order, reship: row.quickAction === "reship" });
  };

  const [label, setLabel] = useState<LabelTarget>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(id);
  }, [success]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          ref={searchRef}
          type="search"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full py-2.5 pl-9 pr-3 text-sm rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red"
        />
      </div>
      <QueueChips
        value={filters.queue}
        counts={{
          needs_packing: attention?.totalActionRequired,
          overdue: attention?.overduePaid,
          ready_to_ship: handoffs?.readyToShip,
          shipped: handoffs?.noScan,
        }}
        hot={[...(handoffs?.notHandedOff ? (["ready_to_ship"] as const) : []), ...(handoffs?.noScan ? (["shipped"] as const) : [])]}
        onChange={(queue) => setFilters({ queue })}
      />
      {rangeApplies(filters) && <RangeChips value={filters.range} onChange={(range) => setFilters({ range })} />}
      <PickupCard onSuccess={setSuccess} />
      {filters.queue === "ready_to_ship" && rows && rows.length > 0 && (
        <button
          type="button"
          onClick={() => setBulkHandoff(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold"
        >
          <Truck className="w-3.5 h-3.5" /> {t("handoff.markAll", { count: rows.length })}
        </button>
      )}

      {success && (
        <p role="status" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-2"><Check className="w-4 h-4" /> {success}</span>
          <button type="button" onClick={() => setSuccess(null)} aria-label={tCommon("dismiss")} className="p-1 rounded hover:bg-emerald-500/20"><X className="w-3.5 h-3.5" /></button>
        </p>
      )}

      {!rows ? (
        <OrdersSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={<SearchX className="w-8 h-8" />} title={t("empty")}>
          {hasActiveFilters(filters) && (
            <button type="button" onClick={clear} className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              {t("clearFilters")}
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <OrderRow key={row.id} row={row} onQuickAction={openLabel} />
            ))}
          </ul>
          {rows.length >= ORDERS_LIMIT && (
            <p className="text-center text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{tCommon("showingLatest", { count: ORDERS_LIMIT })}</p>
          )}
        </>
      )}

      <HandoffDialog
        open={bulkHandoff}
        orders={(rows ?? []).map((r) => ({ id: r.id, orderNumber: r.orderNumber, customer: r.customer }))}
        onClose={() => setBulkHandoff(false)}
        onDone={setSuccess}
      />

      <ShippingLabelModal
        order={label?.order ?? null}
        isOpen={Boolean(label)}
        reship={label?.reship ?? false}
        onClose={() => setLabel(null)}
        onSuccess={setSuccess}
      />
    </div>
  );
}

/** The Orders desk (plan 0009 Screen 4): queues, range and search in the URL; a row opens the Order's page. */
export function OrdersList() {
  const t = useTranslations("admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Old `?order=` bookmarks (the drawer is gone) go to the Order's own page.
  const legacyHref = legacyOrderParamHref(new URLSearchParams(searchParams.toString()));
  useEffect(() => {
    if (legacyHref) router.replace(legacyHref);
  }, [legacyHref, router]);
  if (legacyHref) return <OrdersSkeleton />;

  return (
    <div className="space-y-5 pb-24 sm:pb-12">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("orders.title")}</h1>
      <QueryErrorBoundary
        fallback={(retry) => (
          <EmptyState title={t("common.queryFailed")}>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </EmptyState>
        )}
      >
        <ListBody />
      </QueryErrorBoundary>
    </div>
  );
}
