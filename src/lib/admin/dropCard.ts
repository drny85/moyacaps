/** Drops page view models (plan 0009 D22): one card per Drop, the page's metrics, and which Products can still get one. */
import { hasDropHistory } from "../../../convex/catalog/model";

export type DropStatus = "scheduled" | "live" | "archived";

export type DropRowInput = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  image: string;
  catalogShot?: string;
  silhouette: string;
  stock: number;
  isDrop?: boolean;
  dropDate?: number;
  dropStatus?: DropStatus;
  dropBadgeTextEn?: string;
  dropBadgeTextEs?: string;
  subscribersCount: number;
  /** Decided server-side against the caller's clock (convex/catalog/model.ts computedDropStatus). */
  computedStatus: DropStatus;
  archivedAt?: number;
};

export type Countdown = { d: number; h: number; m: number; s: number; past: boolean };

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function countdown(target: number, now: number): Countdown {
  const left = target - now;
  if (left <= 0) return { d: 0, h: 0, m: 0, s: 0, past: true };
  return {
    d: Math.floor(left / DAY),
    h: Math.floor((left % DAY) / HOUR),
    m: Math.floor((left % HOUR) / MIN),
    s: Math.floor((left % MIN) / SEC),
    past: false,
  };
}

export type DropCardVM = {
  variantId: string;
  name: string;
  image: string;
  status: DropStatus;
  dateLabel?: string;
  countdown?: Countdown;
  subscribers: number;
  stock: number;
  badge?: string;
  canRelease: boolean;
  canReschedule: boolean;
  canCancel: boolean;
};

type Locale = "en" | "es";

export function toDropCard(row: DropRowInput, locale: Locale, now: number): DropCardVM {
  const status = row.computedStatus;
  const badge = locale === "es" ? row.dropBadgeTextEs : row.dropBadgeTextEn;
  return {
    variantId: row.variantId,
    name: locale === "es" ? row.nameEs : row.nameEn,
    image: row.catalogShot || row.image,
    status,
    dateLabel: row.dropDate === undefined ? undefined : new Date(row.dropDate).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
    countdown: status === "scheduled" && row.dropDate !== undefined ? countdown(row.dropDate, now) : undefined,
    subscribers: row.subscribersCount,
    stock: row.stock,
    badge: badge || undefined,
    canRelease: status === "scheduled",
    canReschedule: status !== "archived",
    canCancel: status !== "archived",
  };
}

export type DropMetrics = { scheduled: number; live: number; subscribers: number; nextDropAt?: number };

export function dropMetrics(rows: DropRowInput[], now: number): DropMetrics {
  const metrics: DropMetrics = { scheduled: 0, live: 0, subscribers: 0, nextDropAt: undefined };
  for (const row of rows) {
    metrics.subscribers += row.subscribersCount;
    if (row.computedStatus === "live") metrics.live += 1;
    if (row.computedStatus === "scheduled") {
      metrics.scheduled += 1;
      if (row.dropDate !== undefined && row.dropDate > now && (metrics.nextDropAt === undefined || row.dropDate < metrics.nextDropAt)) {
        metrics.nextDropAt = row.dropDate;
      }
    }
  }
  return metrics;
}

/** Products with no drop history and not archived: the "schedule a drop" picker. */
export function schedulableProducts<T extends { isDrop?: boolean; dropDate?: number; dropStatus?: string; archivedAt?: number }>(rows: T[]): T[] {
  return rows.filter((r) => r.archivedAt === undefined && !hasDropHistory(r as Parameters<typeof hasDropHistory>[0]));
}
