/**
 * Shippo tracking webhook (`/shippo-webhook`): request authorization and payload parsing.
 * Pure, so the route in http.ts stays thin and these rules are unit tested.
 *
 * Shippo's dashboard only takes a URL, so the secret travels as `?secret=`; a header is
 * accepted too for callers that can send one. Without SHIPPO_WEBHOOK_SECRET nothing is
 * accepted: a forged event could mark an order delivered and email the customer.
 */
import { isValidSharedSecret } from "../lib/secrets";

export const SHIPPO_SECRET_HEADERS = ["x-shippo-secret", "shippo-secret", "x-webhook-secret"] as const;

export type ShippoAuth = "ok" | "unconfigured" | "unauthorized";

export function authorizeShippoRequest(url: URL, headers: Headers, secret: string | undefined): ShippoAuth {
  if (!secret) return "unconfigured";
  const candidates = [url.searchParams.get("secret"), ...SHIPPO_SECRET_HEADERS.map((name) => headers.get(name))];
  // Check every candidate so the response time does not depend on which one matched.
  const matches = candidates.map((candidate) => isValidSharedSecret(candidate, secret));
  return matches.some(Boolean) ? "ok" : "unauthorized";
}

export type ShippoTracking = {
  trackingNumber: string;
  carrier?: string;
  status: string;
  statusDetails?: string;
  statusDate?: string;
  location?: { city?: string; state?: string; zip?: string; country?: string };
};

type ParsedShippo = { kind: "tracking"; tracking: ShippoTracking } | { kind: "ignored"; reason: "missing_tracking_number" };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;

/** Reads Shippo's `track_updated` body (fields under `data`, or at the top level). */
export function parseShippoTracking(body: unknown): ParsedShippo {
  const payload = asRecord(body);
  const data = asRecord(payload.data ?? payload);
  const trackingNumber = optionalString(data.tracking_number)?.trim();
  if (!trackingNumber) return { kind: "ignored", reason: "missing_tracking_number" };

  const status = asRecord(data.tracking_status);
  const loc = asRecord(status.location ?? data.location);
  const hasLocation = Object.keys(loc).length > 0;
  return {
    kind: "tracking",
    tracking: {
      trackingNumber,
      carrier: optionalString(data.carrier) || undefined,
      status: optionalString(status.status ?? data.status) || "UNKNOWN",
      statusDetails: optionalString(status.status_details ?? data.status_details) || undefined,
      statusDate: optionalString(status.status_date ?? data.status_date) || undefined,
      location: hasLocation
        ? {
            city: optionalString(loc.city),
            state: optionalString(loc.state),
            zip: optionalString(loc.zip),
            country: optionalString(loc.country),
          }
        : undefined,
    },
  };
}
