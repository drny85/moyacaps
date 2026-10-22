/**
 * View rules for the USPS Pickup card on the Orders desk. Dates are the Administrator's local
 * day (YYYY-MM-DD) and times their local clock (HH:MM). Pure; covered by pickupCard.test.ts.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** The local day of `now` as YYYY-MM-DD. */
export function localDay(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Epoch ms of a local date and HH:MM time, or NaN when either is malformed. */
export function localTimeMs(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  return new Date(`${date}T${time}:00`).getTime();
}

/** USPS customer service, the only way to change or cancel a pickup. */
export const USPS_PHONE = "1-800-275-8777";

type Waiting = { orderId: string };
type Upcoming = { pickupDate: string };

export type PickupCardView = {
  /** Nothing waiting and nothing scheduled: the card is not shown. */
  hidden: boolean;
  /** Priority/international packages Shippo can schedule. */
  apiCount: number;
  /** Ground Advantage (or non-Shippo) packages for usps.com. */
  uspsSiteCount: number;
  /** The chosen date already has a pickup, so the form is disabled. */
  dateTaken: boolean;
  canSchedule: boolean;
  /** Ground Advantage packages can ride along on a Priority pickup for the same stop. */
  canRideAlong: boolean;
};

export function pickupCardView(
  desk: { api: Waiting[]; uspsSite: Waiting[]; upcoming: Upcoming[] },
  pickupDate: string
): PickupCardView {
  const apiCount = desk.api.length;
  const uspsSiteCount = desk.uspsSite.length;
  const dateTaken = desk.upcoming.some((p) => p.pickupDate === pickupDate);
  return {
    hidden: apiCount === 0 && uspsSiteCount === 0 && desk.upcoming.length === 0,
    apiCount,
    uspsSiteCount,
    dateTaken,
    canSchedule: apiCount > 0 && !dateTaken,
    canRideAlong: uspsSiteCount > 0 && (apiCount > 0 || desk.upcoming.length > 0),
  };
}
