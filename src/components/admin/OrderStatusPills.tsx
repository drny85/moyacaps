import {
  FULFILLMENT_LABELS,
  FULFILLMENT_TONES,
  PAYMENT_LABELS,
  PAYMENT_TONES,
  isCancelledOrder,
  type AdminTone,
  type OrderLifecycle,
} from "@/lib/orderStatus";

const TONES: Record<AdminTone, string> = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10",
};

function Pill({ tone, label, prefix }: { tone: AdminTone; label: string; prefix: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${TONES[tone]}`}
    >
      <span className="opacity-60 font-medium">{prefix}</span> {label}
    </span>
  );
}

/** Admin view of an Order's lifecycle (ADR 0024): cancelled marker, Payment Status, Fulfillment Status. */
export function OrderStatusPills({ order }: { order: OrderLifecycle }) {
  const payment = order.paymentStatus ?? "awaiting_payment";
  const fulfillment = order.fulfillmentStatus ?? "unfulfilled";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {isCancelledOrder(order) && <Pill tone="zinc" prefix="" label="Cancelled" />}
      <Pill tone={PAYMENT_TONES[payment]} prefix="$" label={PAYMENT_LABELS[payment]} />
      {payment !== "awaiting_payment" && (
        <Pill tone={FULFILLMENT_TONES[fulfillment]} prefix="📦" label={FULFILLMENT_LABELS[fulfillment]} />
      )}
    </div>
  );
}
