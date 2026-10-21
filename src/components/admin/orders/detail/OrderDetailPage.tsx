"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { LabelHistoryCard } from "@/components/admin/LabelHistoryCard";
import { OrderRefundsPanel } from "@/components/admin/OrderRefundsPanel";
import { ShippingLabelModal } from "@/components/admin/ShippingLabelModal";
import { EmptyState } from "@/components/admin/products/EmptyState";
import { useAdminShortcuts } from "@/components/admin/products/useAdminShortcuts";
import { adminStatusSummary } from "@/lib/orderStatus";
import type { PackingLine } from "@/lib/admin/orderDetail";
import { AddressDialog } from "./AddressDialog";
import { CancelDialog } from "./CancelDialog";
import { DangerZone } from "./DangerZone";
import { ItemsSection } from "./ItemsSection";
import { LabelsSection } from "./LabelsSection";
import { ManualTrackingDialog } from "./ManualTrackingDialog";
import { MoneySection } from "./MoneySection";
import { NextActionCard } from "./NextActionCard";
import { NotesSection } from "./NotesSection";
import { OrderDetailSkeleton } from "./OrderDetailSkeleton";
import { OrderHeader } from "./OrderHeader";
import { PackingSheet } from "./PackingSheet";
import { PackingSlipPrint } from "./PackingSlipPrint";
import { ShipToSection } from "./ShipToSection";
import { useOrderDetail } from "./useOrderDetail";
import type { AddressForm } from "./useOrderDetail";

type Dialog = "label" | "reship" | "deliver" | "revert" | "address" | "tracking" | "cancel" | null;

/** One Order, built around its next action (plan 0009 Screen 5). */
export function OrderDetailPage({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("admin.orderDetail");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const { order, vm, nextAction, manualMoves, busy, error, success, dismissError, actions } = useOrderDetail(orderNumber);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sheet, setSheet] = useState<PackingLine | null>(null);
  const close = () => setDialog(null);

  // The open form (address or notes) registers what ⌘S should submit; nothing open, nothing happens.
  const submitRef = useRef<(() => void) | null>(null);
  const registerSubmit = (fn: (() => void) | null) => {
    submitRef.current = fn;
  };
  useAdminShortcuts({
    escape: () => router.push("/admin/orders"),
    "mod+s": () => submitRef.current?.(),
  });

  if (order === undefined) return <OrderDetailSkeleton />;
  if (order === null || !vm || !nextAction) {
    return (
      <EmptyState title={t("notFound")} body={t("notFoundBody", { orderNumber })}>
        <Link href="/admin/orders" className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">{t("back")}</Link>
      </EmptyState>
    );
  }

  const addressInitial: AddressForm = {
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    line1: order.shippingAddress?.line1 ?? "",
    line2: order.shippingAddress?.line2 ?? "",
    city: order.shippingAddress?.city ?? "",
    state: order.shippingAddress?.state ?? "",
    postalCode: order.shippingAddress?.postalCode ?? "",
    country: order.shippingAddress?.country ?? "US",
  };

  return (
    <>
      <div className="space-y-5 pb-24 sm:pb-12 print:hidden">
        <OrderHeader header={vm.header} />

        {error && (
          <p role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</span>
            <button type="button" onClick={dismissError} aria-label={tCommon("dismiss")} className="p-1 rounded hover:bg-rose-500/20"><X className="w-3.5 h-3.5" /></button>
          </p>
        )}
        {success && (
          <p role="status" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="w-4 h-4" /> {success}
          </p>
        )}

        <NextActionCard
          action={nextAction}
          busy={busy}
          onBuyLabel={() => setDialog("label")}
          onReship={() => setDialog("reship")}
          onMarkDelivered={() => setDialog("deliver")}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <ItemsSection items={vm.items} itemCount={vm.itemCount} onOpen={setSheet} />
            <MoneySection money={vm.money} />
            <div id="refunds" className="scroll-mt-20">
              <OrderRefundsPanel order={order} onMessage={() => undefined} onError={() => undefined} />
            </div>
            <NotesSection notes={vm.notes} busy={busy} onSave={actions.saveNotes} registerSubmit={registerSubmit} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <ShipToSection shipTo={vm.shipTo} onEdit={() => setDialog("address")} />
            <LabelsSection
              labels={vm.labels}
              manualMoves={manualMoves}
              showDeliverHere={nextAction.kind !== "mark_delivered"}
              onPrintLabel={() => setDialog("label")}
              onManualTracking={() => setDialog("tracking")}
              onMarkDelivered={() => setDialog("deliver")}
              onRevert={() => setDialog("revert")}
            />
            <LabelHistoryCard order={order} />
            {vm.danger.canCancel && <DangerZone onCancel={() => setDialog("cancel")} />}
          </div>
        </div>
      </div>

      <PackingSlipPrint vm={vm} statusLine={adminStatusSummary(order)} />

      <PackingSheet line={sheet} onClose={() => setSheet(null)} />
      <ShippingLabelModal order={order} isOpen={dialog === "label" || dialog === "reship"} reship={dialog === "reship"} onClose={close} />
      <ConfirmDialog open={dialog === "deliver"} title={t("labels.deliverTitle")} body={t("labels.deliverBody")} confirmLabel={t("labels.markDelivered")} busy={busy} onClose={close}
        onConfirm={async () => { if (await actions.markDelivered()) close(); }} />
      <ConfirmDialog open={dialog === "revert"} title={t("labels.revertTitle")} body={t("labels.revertBody")} confirmLabel={t("labels.revert")} busy={busy} onClose={close}
        onConfirm={async () => { if (await actions.revert()) close(); }} />
      <AddressDialog open={dialog === "address"} initial={addressInitial} busy={busy} onSave={actions.saveAddress} onClose={close} registerSubmit={registerSubmit} />
      <ManualTrackingDialog open={dialog === "tracking"} initial={{ carrier: order.carrier, trackingNumber: vm.labels.trackingNumber }} busy={busy} onSave={actions.saveTracking} onClose={close} />
      <CancelDialog open={dialog === "cancel"} refundable={vm.danger.refundable} busy={busy} onConfirm={actions.cancel} onClose={close} />
    </>
  );
}
