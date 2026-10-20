import { AlertTriangle, CheckCircle2, Clock, RotateCcw, ShieldCheck, Tag, Truck, Undo2, XCircle } from "lucide-react";
import { customerBadges, type CustomerBadge, type OrderLifecycle } from "@/lib/orderStatus";

const STYLES: Record<CustomerBadge, { tone: string; Icon: typeof CheckCircle2 }> = {
  cancelled: { tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: XCircle },
  refunded: { tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: RotateCcw },
  partially_refunded: { tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: RotateCcw },
  placed: { tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: Clock },
  paid: { tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
  label_purchased: { tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", Icon: Tag },
  in_transit: { tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", Icon: Truck },
  delivered: { tone: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", Icon: ShieldCheck },
  delivery_exception: { tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: AlertTriangle },
  returned: { tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: Undo2 },
};

/** The Customer-facing status pills for an Order: money first, then the package (ADR 0024). */
export function OrderStatusBadges({
  order,
  labels,
  className = "px-3 py-1.5 text-xs font-mono font-bold",
}: {
  order: OrderLifecycle;
  labels: Record<CustomerBadge, string>;
  className?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {customerBadges(order).map((badge) => {
        const { tone, Icon } = STYLES[badge];
        return (
          <span key={badge} className={`inline-flex items-center gap-1.5 rounded-full border ${tone} ${className}`}>
            <Icon className="w-3.5 h-3.5" /> {labels[badge]}
          </span>
        );
      })}
    </div>
  );
}
