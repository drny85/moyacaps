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
  /** Past its date but never released: nothing flips a Drop live on its own, and the storefront keeps blocking purchase. */
  awaitingRelease: boolean;
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

/** Awaiting release: marked a drop, past its date, but `releaseDropNow` never ran. */
function awaitsRelease(row: DropRowInput, now: number): boolean {
  return row.isDrop === true && row.dropStatus === "scheduled" && row.dropDate !== undefined && row.dropDate <= now;
}

/** The status the Administrator works from: a drop past its date is still "scheduled" until released. */
export function adminDropStatus(row: DropRowInput, now: number): DropStatus {
  return awaitsRelease(row, now) ? "scheduled" : row.computedStatus;
}

export function toDropCard(row: DropRowInput, locale: Locale, now: number): DropCardVM {
  const awaitingRelease = awaitsRelease(row, now);
  const status = adminDropStatus(row, now);
  const badge = locale === "es" ? row.dropBadgeTextEs : row.dropBadgeTextEn;
  return {
    variantId: row.variantId,
    name: locale === "es" ? row.nameEs : row.nameEn,
    image: row.catalogShot || row.image,
    status,
    awaitingRelease,
    dateLabel: row.dropDate === undefined ? undefined : new Date(row.dropDate).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
    countdown: status === "scheduled" && !awaitingRelease && row.dropDate !== undefined ? countdown(row.dropDate, now) : undefined,
    subscribers: row.subscribersCount,
    stock: row.stock,
    badge: badge || undefined,
    canRelease: status === "scheduled",
    // A cancelled (archived) drop can be scheduled again; scheduleDrop accepts it.
    canReschedule: true,
    canCancel: status !== "archived",
  };
}

/** Where the schedule dialog starts: the row's date while it is still ahead, else the dialog's own default. */
export function scheduleStartDate(dropDate: number | undefined, now: number): number | undefined {
  return dropDate !== undefined && dropDate > now ? dropDate : undefined;
}

export type DropMetrics = { scheduled: number; live: number; subscribers: number; nextDropAt?: number };

export function dropMetrics(rows: DropRowInput[], now: number): DropMetrics {
  const metrics: DropMetrics = { scheduled: 0, live: 0, subscribers: 0, nextDropAt: undefined };
  for (const row of rows) {
    metrics.subscribers += row.subscribersCount;
    const status = adminDropStatus(row, now);
    if (status === "live") metrics.live += 1;
    if (status === "scheduled") {
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
