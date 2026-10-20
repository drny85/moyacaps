/**
 * Tracking Number rules (CONTEXT.md "Tracking Number"): a Tracking Number exists only once a
 * carrier label is bought. Settlement used to mint a placeholder `GL-TRK-` number for every
 * paid Order; those may stay on old Orders but are never shown or read as carrier tracking.
 * Pure; covered by trackingNumber.test.ts.
 */

/** Prefix of the placeholder numbers settlement minted before PR 5 of plan 0008. */
export const LEGACY_PLACEHOLDER_PREFIX = "GL-TRK-";

/** True for a real carrier number; false for nothing or a legacy placeholder. */
export function isCarrierTrackingNumber(trackingNumber: string | undefined): trackingNumber is string {
  return Boolean(trackingNumber && trackingNumber.trim() !== "" && !trackingNumber.startsWith(LEGACY_PLACEHOLDER_PREFIX));
}

/** The Order's carrier Tracking Number, or undefined when it has none (or only a legacy placeholder). */
export function carrierTrackingNumber(order: { trackingNumber?: string }): string | undefined {
  return isCarrierTrackingNumber(order.trackingNumber) ? order.trackingNumber : undefined;
}
