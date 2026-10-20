/**
 * Dates and times shown to people, in the store's own time zone. Convex runs in UTC, so a
 * bare toLocaleString() on the server shows UTC (an order placed at 9:10 AM in New York reads
 * 1:10 PM). Every human-facing date formatted in convex/ goes through here. Pure; covered by
 * storeTime.test.ts.
 */

/** The store is in the Bronx. */
export const STORE_TIME_ZONE = "America/New_York";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const zoneFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIME_ZONE,
  timeZoneName: "short",
});

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "EDT" or "EST" at that instant. */
function zoneAbbreviation(ms: number): string {
  return zoneFormat.formatToParts(ms).find((part) => part.type === "timeZoneName")?.value ?? "ET";
}

// Some ICU versions put a narrow no-break space before AM/PM; emails and notes use a plain one.
const plainSpaces = (text: string) => text.replace(/[\u202f\u00a0]/g, " ");

/** "Oct 20, 2026, 9:10 AM EDT". */
export function formatStoreDateTime(ms: number): string {
  return plainSpaces(`${dateTimeFormat.format(ms)} ${zoneAbbreviation(ms)}`);
}

/** "Oct 20, 2026", the calendar day in the store's time zone. */
export function formatStoreDate(ms: number): string {
  return plainSpaces(dateFormat.format(ms));
}
