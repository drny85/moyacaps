/**
 * Pure rules for asking USPS to collect labelled packages (Package Pickup). Shippo's pickups API
 * takes only Priority Mail, Priority Mail Express, international and return labels; every other
 * USPS label (Ground Advantage) is scheduled by hand on usps.com. USPS allows one pickup request
 * per address per day, and extra packages left out are collected on that same stop. A pickup is
 * free and cannot be changed or cancelled through Shippo: the Administrator calls USPS with the
 * confirmation code. Covered by pickupPlan.test.ts.
 */
import { v } from "convex/values";
import type { ShipFromAddress } from "./shipFrom";
import { STORE_TIME_ZONE } from "../lib/storeTime";
import { isSimulatedRate, type ShippoPolicy } from "./shippoMode";

/** USPS's own scheduler, which takes every service including Ground Advantage. */
export const USPS_PICKUP_SITE_URL = "https://tools.usps.com/schedule-pickup-steps.htm";

/** Where the carrier finds the packages. Security Deck and Shipping Dock are DHL-only. */
export const PICKUP_LOCATIONS = [
  "Front Door",
  "Back Door",
  "Side Door",
  "Knock on Door",
  "Ring Bell",
  "Mail Room",
  "Office",
  "Reception",
  "In/At Mailbox",
  "Other",
] as const;

export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];

export const pickupLocationValidator = v.union(
  ...(PICKUP_LOCATIONS.map((l) => v.literal(l)) as [
    ReturnType<typeof v.literal<PickupLocation>>,
    ReturnType<typeof v.literal<PickupLocation>>,
    ...ReturnType<typeof v.literal<PickupLocation>>[],
  ])
);

export type PickupRoute = "api" | "usps_site" | "not_usps";

/** How a label's package gets a pickup: through Shippo, on usps.com, or not at all (not USPS). */
export function pickupRoute(carrier: string | undefined, serviceLevel: string | undefined): PickupRoute {
  const c = (carrier ?? "").toLowerCase();
  if (!c.includes("usps") && !c.includes("postal")) return "not_usps";
  const s = (serviceLevel ?? "").toLowerCase();
  if (s.includes("priority") || s.includes("international") || s.includes("return")) return "api";
  return "usps_site";
}

/** A labelled Order waiting for the carrier. */
export type PickupCandidate = {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  carrier?: string;
  serviceLevel?: string;
  transactionId?: string;
  /** The label's Shippo rate: names the USPS carrier account the pickup must use. */
  rateId?: string;
};

/**
 * Splits waiting packages into those Shippo can schedule and those for usps.com. An eligible
 * label with no Shippo transaction (bought elsewhere) cannot be sent to the API.
 */
export function groupPickupCandidates<T extends PickupCandidate>(candidates: T[]): { api: T[]; uspsSite: T[] } {
  const api: T[] = [];
  const uspsSite: T[] = [];
  for (const c of candidates) {
    const route = pickupRoute(c.carrier, c.serviceLevel);
    if (route === "not_usps") continue;
    if (route === "api" && c.transactionId) api.push(c);
    else uspsSite.push(c);
  }
  return { api, uspsSite };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `date` (YYYY-MM-DD) is a real day USPS collects on: Monday to Saturday. */
export function isPickupDay(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return false;
  return day.getUTCDay() !== 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The default pickup date: the day after `now` (local time), skipping Sunday. */
export function nextPickupDate(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/** Carriers refuse special characters such as / & * in address lines. */
const clean = (s: string) => s.replace(/[^A-Za-z0-9 .,'#-]/g, " ").replace(/\s+/g, " ").trim();

/** The ship-from address made safe for a pickup request. The email is left as is. */
export function pickupAddress(address: ShipFromAddress): ShipFromAddress {
  return {
    ...address,
    name: clean(address.name),
    ...(address.company !== undefined && { company: clean(address.company) }),
    street1: clean(address.street1),
    ...(address.street2 !== undefined && { street2: clean(address.street2) }),
    city: clean(address.city),
  };
}

const wallClockFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/**
 * The pickup window as Shippo reads it. Shippo takes `requested_start_time` as the wall-clock
 * time at the pickup address and converts it to UTC itself, so sending the true instant shifts
 * the window by the zone offset (9 AM ET reached USPS as 1 PM). This returns a Date whose UTC
 * fields are the store's local clock at `ms`.
 */
export function carrierWallClock(ms: number, timeZone: string = STORE_TIME_ZONE): Date {
  const parts = Object.fromEntries(wallClockFormat(timeZone).formatToParts(ms).map((p) => [p.type, p.value]));
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  );
}

/**
 * A short message for a pickup Shippo refused. Shippo answers with the whole pickup object;
 * only its messages and its object ID (which Shippo support asks for) are useful.
 */
export function pickupFailureMessage(body: string | undefined): string {
  let messages: string[] = [];
  let objectId: string | undefined;
  try {
    const parsed = JSON.parse(body ?? "") as { messages?: unknown; object_id?: unknown; detail?: unknown };
    if (Array.isArray(parsed.messages)) {
      messages = parsed.messages.map((m) => (typeof m === "string" ? m : (m as { text?: string })?.text ?? "")).filter(Boolean);
    } else if (typeof parsed.detail === "string") {
      messages = [parsed.detail];
    }
    if (typeof parsed.object_id === "string") objectId = parsed.object_id;
  } catch {
    // Not JSON: keep the generic message.
  }
  const reason = messages.join(" ") || "USPS refused the pickup request.";
  return objectId ? `USPS pickup failed: ${reason} Shippo pickup ID ${objectId} (give it to Shippo support).` : `USPS pickup failed: ${reason}`;
}

/** What a failed pickup log line may carry: times, account and status, never the address or contact. */
export type PickupDiagnostics = {
  sent: { carrierAccount: string; requestedStartTime: string; requestedEndTime: string; transactions: number };
  httpStatus?: number;
  echoed: {
    objectId?: string;
    status?: string;
    carrierAccount?: string;
    requestedStartTime?: string;
    requestedEndTime?: string;
    confirmedStartTime?: string;
    confirmedEndTime?: string;
    timezone?: string;
    isTest?: boolean;
    messages?: string[];
  };
};

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Picks the fields worth logging from Shippo's answer to a failed pickup (its body echoes the
 * whole pickup, address and phone included), next to what was sent.
 */
export function pickupDiagnostics(
  body: string | undefined,
  sent: PickupDiagnostics["sent"],
  httpStatus?: number
): PickupDiagnostics {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(body ?? "");
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {
    // Not JSON: log only what was sent.
  }
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map((m) => (typeof m === "string" ? m : str((m as { text?: unknown })?.text) ?? "")).filter(Boolean)
    : undefined;
  return {
    sent,
    ...(httpStatus !== undefined && { httpStatus }),
    echoed: {
      objectId: str(raw.object_id),
      status: str(raw.status),
      carrierAccount: str(raw.carrier_account),
      requestedStartTime: str(raw.requested_start_time),
      requestedEndTime: str(raw.requested_end_time),
      confirmedStartTime: str(raw.confirmed_start_time),
      confirmedEndTime: str(raw.confirmed_end_time),
      timezone: str(raw.timezone),
      ...(typeof raw.is_test === "boolean" && { isTest: raw.is_test }),
      ...(messages && { messages }),
    },
  };
}

/** Whether a recorded pickup with this Shippo status uses up its day. */
export function pickupBlocksDate(status: string): boolean {
  return status !== "ERROR" && status !== "CANCELLED";
}

export type PickupRequestInput = {
  pickupDate: string;
  requestedStartTime: number;
  requestedEndTime: number;
  location: PickupLocation;
  instructions?: string;
  /** Waiting packages Shippo can schedule. */
  apiCount: number;
  /** A pickup already holds this day. */
  alreadyScheduled: boolean;
  nowMs: number;
};

export type PickupPlan = { ok: true } | { ok: false; error: string };

/** Whether a pickup request may be sent to Shippo. */
export function planPickupRequest(input: PickupRequestInput): PickupPlan {
  if (input.apiCount === 0) {
    return {
      ok: false,
      error: "No Priority Mail or international label is waiting. Schedule Ground Advantage packages on usps.com.",
    };
  }
  if (!isPickupDay(input.pickupDate)) {
    return { ok: false, error: "Choose a pickup day from Monday to Saturday. USPS does not collect on Sundays." };
  }
  if (input.alreadyScheduled) {
    return {
      ok: false,
      error: `A USPS pickup is already scheduled for ${input.pickupDate}. USPS allows one pickup per day; leave the extra packages out for it.`,
    };
  }
  if (input.requestedEndTime <= input.requestedStartTime) {
    return { ok: false, error: "The pickup window must end after it starts." };
  }
  if (input.requestedEndTime <= input.nowMs) {
    return { ok: false, error: "That pickup window has already passed. Choose a later time." };
  }
  if (input.location === "Other" && !(input.instructions ?? "").trim()) {
    return { ok: false, error: "Say where the packages will be when the location is Other." };
  }
  return { ok: true };
}

export type PickupMode = { ok: true; simulated: boolean } | { ok: false; error: string };

/**
 * Whether the pickup is real or simulated, following the label rules (./shippoMode): a
 * simulated label or a missing key is refused unless this deployment allows simulation.
 */
export function planPickupMode(policy: ShippoPolicy, transactionIds: string[]): PickupMode {
  const simulatedLabel = transactionIds.some(isSimulatedRate);
  if (!simulatedLabel && policy.mode !== "none") return { ok: true, simulated: false };
  if (policy.allowSimulation) return { ok: true, simulated: true };
  if (simulatedLabel) {
    return { ok: false, error: "A waiting label is simulated, so USPS cannot collect it. Void it and buy a real label." };
  }
  return { ok: false, error: "Shippo is not configured (SHIPPO_API_KEY is missing), so no pickup can be scheduled." };
}
