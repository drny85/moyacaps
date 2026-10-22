"use node";

import { Shippo } from "shippo";
import { shippoKeyMode, shippoPolicy } from "./shippoMode";

/** The Shippo SDK for this deployment's key, or null when no real key is configured. */
export function getShippoClient(): Shippo | null {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (shippoKeyMode(apiKey) === "none") return null;
  return new Shippo({ apiKeyHeader: apiKey!.trim() });
}

/** Simulated rates, labels and pickups are off unless this deployment opts in (see ./shippoMode). */
export function currentShippoPolicy() {
  return shippoPolicy({
    apiKey: process.env.SHIPPO_API_KEY,
    allowSimulation: process.env.SHIPPO_ALLOW_SIMULATION,
  });
}
