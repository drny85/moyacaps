/**
 * Pure rules for when the store may use simulated Shippo rates and labels. A simulated label has
 * a made-up tracking number and a sample PDF, so on a real order it would send the Customer
 * fake tracking. Simulation is therefore off unless a deployment opts in with
 * `SHIPPO_ALLOW_SIMULATION=true`, and never with a live key. Convex cannot reliably tell a
 * production deployment from a development one, so the safe answer is the default.
 */

export type ShippoKeyMode = "live" | "test" | "none";

/** What kind of Shippo key is configured. Placeholder values count as no key. */
export function shippoKeyMode(apiKey: string | undefined): ShippoKeyMode {
  const key = (apiKey ?? "").trim();
  if (!key || key === "mock" || key === "test_dummy") return "none";
  if (key.startsWith("shippo_live_")) return "live";
  return "test";
}

export type ShippoPolicy = { mode: ShippoKeyMode; allowSimulation: boolean };

/** Reads the two environment values into a policy. */
export function shippoPolicy(env: { apiKey?: string; allowSimulation?: string }): ShippoPolicy {
  const mode = shippoKeyMode(env.apiKey);
  const optedIn = (env.allowSimulation ?? "").trim().toLowerCase() === "true";
  return { mode, allowSimulation: optedIn && mode !== "live" };
}

export const SIMULATED_RATE_PREFIX = "sim_";

export function isSimulatedRate(rateObjectId: string): boolean {
  return rateObjectId.startsWith(SIMULATED_RATE_PREFIX);
}

/**
 * Message shown to the Administrator when real rates cannot be fetched and simulation is not
 * allowed. `reason` is Shippo's error or the reason no rates came back.
 */
export function ratesUnavailableError(policy: ShippoPolicy, reason?: string): string {
  if (policy.mode === "none") {
    return "Shippo is not configured (SHIPPO_API_KEY is missing), so no real postage rates are available.";
  }
  const detail = reason ? ` Shippo said: ${reason}` : "";
  return `Could not get real postage rates from Shippo.${detail} Check the address and parcel, then refresh rates.`;
}

export type LabelPurchaseMode = { ok: true; simulated: boolean } | { ok: false; error: string };

/**
 * Whether a label for this rate can be bought, and whether it is simulated. A simulated rate or
 * a missing key is refused unless simulation is allowed.
 */
export function planLabelMode(policy: ShippoPolicy, rateObjectId: string): LabelPurchaseMode {
  const simulatedRate = isSimulatedRate(rateObjectId);
  if (!simulatedRate && policy.mode !== "none") return { ok: true, simulated: false };
  if (policy.allowSimulation) return { ok: true, simulated: true };
  if (simulatedRate) {
    return {
      ok: false,
      error: "This is a simulated rate, not real postage. Refresh rates and choose a real carrier rate.",
    };
  }
  return { ok: false, error: "Shippo is not configured (SHIPPO_API_KEY is missing), so no label can be bought." };
}
