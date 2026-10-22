"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Truck, Edit3, MessageCircle, ExternalLink } from "lucide-react";
import { getCarrierTrackingUrl } from "@/lib/tracking";
import { isAddressEditable, isShippedOrder } from "@/lib/orderStatus";
import { orderActionNote, type OrderActionNote } from "@/lib/accountOrders";
import { customerCancellationAllowed } from "@convex/orders/status";
import { OrderReviewActions } from "@/components/reviews/OrderReviewActions";
import { OrderStatusBadges } from "@/components/orders/OrderStatusBadges";
import type { CustomerOrder } from "./types";

const ACTION_NOTES: Record<OrderActionNote, string> = {
  cancellable: "Eligible for address modification & instant refund prior to courier handover.",
  shipped: "In transit with courier. For delivery inquiries or returns, reach Concierge.",
  awaitingDispatch: "Not shipped yet. To cancel this order, reach Concierge.",
  finalized: "Order finalized.",
};

/** One Order on the account page: items, status, address and the actions its state allows. */
export function OrderCard({
  order: ord,
  onEditAddress,
  onCancel,
  onConcierge,
}: {
  order: CustomerOrder;
  onEditAddress: (order: CustomerOrder) => void;
  onCancel: (order: CustomerOrder) => void;
  onConcierge: (orderNumber: string, actionType: "return" | "support") => void;
}) {
  const t = useTranslations("account");
  const locale = useLocale();

  const isCancellable = customerCancellationAllowed(ord);
  const canEditAddress = isAddressEditable(ord);
  const isShipped = isShippedOrder(ord);

  return (
    <div className="p-5 sm:p-6 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-4 shadow-lg hover:shadow-xl transition-shadow">
      {/* Order Meta Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
            Order #{ord.orderNumber}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-zinc-500">
            {new Date(ord.createdAt).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          {ord.trackingNumber && (
            <a
              href={getCarrierTrackingUrl(ord.carrier, ord.trackingNumber) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold hover:underline"
              title="Track shipment on courier portal"
            >
              <Truck className="w-2.5 h-2.5" />
              <span>{ord.carrier ? ord.carrier.split(" ")[0] : "Track"}: {ord.trackingNumber}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status Pills: money first, then the package (ADR 0024) */}
          <OrderStatusBadges
            order={ord}
            className="px-3 py-1 text-xs font-display font-semibold"
            labels={{
              cancelled: t("statusCancelledOnly"),
              refunded: t("statusRefunded"),
              partially_refunded: t("statusPartiallyRefunded"),
              placed: t("statusPlaced"),
              paid: t("statusPaid"),
              label_purchased: t("statusLabelPurchased"),
              in_transit: t("statusDispatched"),
              delivered: t("statusDelivered"),
              delivery_exception: t("statusDeliveryException"),
              returned: t("statusReturned"),
            }}
          />

          <div className="text-right">
            <span className="font-mono font-bold text-base text-zinc-900 dark:text-white block">
              ${Number(ord.total).toFixed(2)} {ord.currency}
            </span>
            {typeof ord.tax === "number" && ord.tax > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 block">
                (incl. ${ord.tax.toFixed(2)} tax)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ord.items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 rounded-2xl glass-dark border border-black/[0.04] dark:border-white/[0.04] flex items-center gap-3"
          >
            <div className="relative w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 p-1 shrink-0">
              <Image src={item.image} alt={item.name} fill className="object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-xs text-zinc-900 dark:text-white truncate">
                {item.name}
              </p>
              <p className="text-[11px] font-mono text-zinc-500">
                Qty: {item.quantity} • ${item.price}.00
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reviews: only delivered Orders have reviewable items */}
      {ord.fulfillmentStatus === "delivered" && (
        <Suspense fallback={null}>
          <OrderReviewActions orderId={ord._id} orderNumber={ord.orderNumber} items={ord.items} />
        </Suspense>
      )}

      {/* Shipping Destination Summary */}
      {ord.shippingAddress && (
        <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2 truncate">
            <Truck className="w-4 h-4 text-moya-green shrink-0" />
            <span className="truncate">
              <strong className="text-zinc-900 dark:text-white">{ord.customerName}</strong> —{" "}
              {ord.shippingAddress.line1}
              {ord.shippingAddress.line2 ? `, ${ord.shippingAddress.line2}` : ""},{" "}
              {ord.shippingAddress.city}, {ord.shippingAddress.state} {ord.shippingAddress.postalCode} (
              {ord.shippingAddress.country})
              {ord.customerPhone ? ` • ${ord.customerPhone}` : ""}
            </span>
          </div>

          {/* Pre-Dispatch: Edit Address Button */}
          {canEditAddress && (
            <button
              onClick={() => onEditAddress(ord)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.06] transition-colors shrink-0 self-start sm:self-auto"
            >
              <Edit3 className="w-3.5 h-3.5 text-moya-red" />
              <span>{t("editAddress")}</span>
            </button>
          )}
        </div>
      )}

      {/* Customer Management Actions Bar */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-mono text-zinc-500">
          {ACTION_NOTES[orderActionNote({ isCancellable, isShipped, canEditAddress })]}
        </div>

        <div className="flex items-center gap-2">
          {/* Pre-Dispatch: Cancel Order Button */}
          {isCancellable && (
            <button
              onClick={() => onCancel(ord)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-display font-bold transition-colors border border-rose-500/20"
            >
              {t("cancelOrder")}
            </button>
          )}

          {/* Concierge Support WhatsApp */}
          <button
            onClick={() => onConcierge(ord.orderNumber, isShipped ? "return" : "support")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-moya-green-deep/10 hover:bg-moya-green-deep/20 text-emerald-600 dark:text-emerald-400 text-xs font-display font-bold transition-colors border border-emerald-500/20"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{t("conciergeHelp")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
