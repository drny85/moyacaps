/** Home page view model (plan 0009 D18): attention strip, revenue tiles, chart, low stock, best sellers. */

export type Window = { revenue: number; orders: number };
export type DaySales = { date: string; revenue: number; orders: number };
export type LowStockInput = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  colorway?: string;
  size?: string;
  stock: number;
  image: string;
};
export type TopVariantInput = { variantId: string; name: string; units: number; revenue: number; image: string };

export type AnalyticsInput = {
  windows: { today: Window; d7: Window; d30: Window };
  dailySales: DaySales[];
  lowStock: LowStockInput[];
  topVariants: TopVariantInput[];
  /** The desk's Problems queue size, counted server-side by the desk's own rule. */
  problemsCount: number;
};
export type AttentionInput = { totalActionRequired: number; overduePaid: number; lowStockCount: number };

export type AttentionId = "needs_packing" | "overdue" | "problems" | "low_stock";
export type Tone = "amber" | "rose" | "purple" | "zinc";
export type HomeVM = {
  attention: Array<{ id: AttentionId; count: number; href: string; tone: Tone }>;
  tiles: Array<{ id: "today" | "d7" | "d30"; revenueLabel: string; orders: number }>;
  chart: { bars: Array<{ date: string; label: string; revenue: number; orders: number; heightPct: number }> };
  lowStock: Array<{ key: string; name: string; detail?: string; stock: number; image: string; href: string }>;
  /** Every low-stock row, including those past the Home list's cap. */
  lowStockTotal: number;
  bestSellers: Array<{ rank: number; name: string; variantId: string; units: number; revenueLabel: string; image: string }>;
};

const ATTENTION: Array<{ id: AttentionId; href: string; tone: Tone }> = [
  { id: "needs_packing", href: "/admin/orders?queue=needs_packing", tone: "amber" },
  { id: "overdue", href: "/admin/orders?queue=overdue", tone: "rose" },
  { id: "problems", href: "/admin/orders?queue=problems", tone: "purple" },
  { id: "low_stock", href: "/admin/products?stock=low", tone: "amber" },
];

const MIN_BAR_PCT = 4;
/** Home shows the lowest rows; the Products grid (stock=low) has them all. */
const LOW_STOCK_ROWS = 8;

export function formatUsd(amount: number, locale: "en" | "es"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function toHomeVM(analytics: AnalyticsInput, attention: AttentionInput, locale: "en" | "es"): HomeVM {
  const counts: Record<AttentionId, number> = {
    needs_packing: attention.totalActionRequired,
    overdue: attention.overduePaid,
    problems: analytics.problemsCount,
    // The same rows the list shows (Caps and tee SKUs), so the pill and the list agree.
    low_stock: analytics.lowStock.length,
  };
  const maxRevenue = Math.max(0, ...analytics.dailySales.map((d) => d.revenue));
  return {
    attention: ATTENTION.map((a) => ({ ...a, count: counts[a.id], tone: counts[a.id] === 0 ? "zinc" : a.tone })),
    tiles: (["today", "d7", "d30"] as const).map((id) => ({
      id,
      revenueLabel: formatUsd(analytics.windows[id].revenue, locale),
      orders: analytics.windows[id].orders,
    })),
    chart: {
      bars: analytics.dailySales.map((d) => ({
        ...d,
        label: String(Number(d.date.slice(8, 10))),
        heightPct: maxRevenue > 0 ? Math.max(MIN_BAR_PCT, Math.round((d.revenue / maxRevenue) * 100)) : MIN_BAR_PCT,
      })),
    },
    lowStockTotal: analytics.lowStock.length,
    lowStock: analytics.lowStock.slice(0, LOW_STOCK_ROWS).map((row) => ({
      key: [row.variantId, row.colorway, row.size].filter(Boolean).join("/"),
      name: locale === "es" ? row.nameEs : row.nameEn,
      detail: row.colorway ? `${row.colorway} · ${row.size}` : undefined,
      stock: row.stock,
      image: row.image,
      href: `/admin/products/${row.variantId}`,
    })),
    bestSellers: analytics.topVariants.map((t, i) => ({
      rank: i + 1,
      name: t.name,
      variantId: t.variantId,
      units: t.units,
      revenueLabel: formatUsd(t.revenue, locale),
      image: t.image,
    })),
  };
}
