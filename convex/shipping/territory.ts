/**
 * Fulfillment Territory (CONTEXT.md): the 50 US States and the District of Columbia. Excluded:
 * Puerto Rico, the US Virgin Islands, Guam and every other territory, military addresses
 * (states AA/AE/AP) and every international destination. The one source of truth for the
 * label flows (shipping/functions) and the payment webhook flag (orders/settlement).
 * Pure: no Convex or Node imports, covered by territory.test.ts.
 */

/** USPS codes of the 50 States plus DC. */
export const FULFILLMENT_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

/** Armed Forces Americas / Europe / Pacific (APO, FPO, DPO). */
const MILITARY_STATES = ["AA", "AE", "AP"] as const;

/** Inhabited territories and freely associated states that use US addresses. */
const TERRITORY_STATES = ["PR", "VI", "GU", "MP", "AS", "FM", "MH", "PW", "UM"] as const;

/** Full names an address may carry instead of the USPS code. */
const STATE_NAMES: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
  CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID",
  ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR",
  PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA",
  "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC", "WASHINGTON DC": "DC", "WASHINGTON D.C.": "DC", "D.C.": "DC",
  "PUERTO RICO": "PR", "VIRGIN ISLANDS": "VI", "US VIRGIN ISLANDS": "VI", "U.S. VIRGIN ISLANDS": "VI",
  GUAM: "GU", "NORTHERN MARIANA ISLANDS": "MP", "AMERICAN SAMOA": "AS",
};

const US_COUNTRIES = ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"];

/**
 * ZIP ranges that are never in the territory whatever state the address claims:
 * PR 006/007/009, VI 008, Guam, the Marianas and the freely associated states 969,
 * American Samoa 96799, AA 340, AE 090–098, AP 962–966.
 */
function zipExclusion(zip: string): TerritoryExclusion | undefined {
  const z5 = zip.replace(/\s+/g, "").slice(0, 5);
  const z3 = z5.slice(0, 3);
  if (["006", "007", "008", "009", "969"].includes(z3) || z5 === "96799") return "us_territory";
  if (z3 === "340" || /^09[0-8]$/.test(z3) || /^96[2-6]$/.test(z3)) return "military";
  return undefined;
}

export type TerritoryExclusion = "international" | "us_territory" | "military" | "unknown_state";

export type TerritoryVerdict =
  | { inTerritory: true; state: string }
  | { inTerritory: false; exclusion: TerritoryExclusion; reason: string };

export type TerritoryAddress = { state?: string | null; postalCode?: string | null; country?: string | null };

/** USPS code for a state field: codes pass through, full names map, anything else is returned as typed. */
export function normalizeState(state: string | null | undefined): string {
  const upper = (state || "").trim().toUpperCase().replace(/\s+/g, " ");
  return STATE_NAMES[upper] ?? upper;
}

function excluded(exclusion: TerritoryExclusion, detail: string): TerritoryVerdict {
  return {
    inTerritory: false,
    exclusion,
    reason: `${detail} Good Luck ships only to the 50 US States and the District of Columbia.`,
  };
}

/** Whether an address is inside the Fulfillment Territory, and why not when it is outside. */
export function checkFulfillmentTerritory(address: TerritoryAddress): TerritoryVerdict {
  // A missing country is a US address (Stripe and the admin form always send one).
  const country = (address.country || "US").trim().toUpperCase();
  if (!US_COUNTRIES.includes(country)) {
    return excluded("international", `International destinations (${country}) are outside the Fulfillment Territory.`);
  }

  const state = normalizeState(address.state);
  if ((MILITARY_STATES as readonly string[]).includes(state)) {
    return excluded("military", `Military addresses (${state}) are outside the Fulfillment Territory.`);
  }
  if ((TERRITORY_STATES as readonly string[]).includes(state)) {
    return excluded("us_territory", `US territories (${state}) are outside the Fulfillment Territory.`);
  }

  const zip = (address.postalCode || "").trim();
  const byZip = zipExclusion(zip);
  if (byZip === "military") {
    return excluded("military", `ZIP ${zip} is a military (APO/FPO/DPO) ZIP, outside the Fulfillment Territory.`);
  }
  if (byZip === "us_territory") {
    return excluded("us_territory", `ZIP ${zip} belongs to a US territory, outside the Fulfillment Territory.`);
  }

  if (!(FULFILLMENT_STATES as readonly string[]).includes(state)) {
    return excluded("unknown_state", `State "${address.state || ""}" is not one of the 50 US States or DC.`);
  }
  return { inTerritory: true, state };
}

/** Label-flow shape of `checkFulfillmentTerritory` (rates and label purchase refuse with `reason`). */
export function isExcludedTerritory(state?: string, zip?: string, country?: string): {
  isExcluded: boolean;
  reason?: string;
} {
  const verdict = checkFulfillmentTerritory({ state, postalCode: zip, country });
  return verdict.inTerritory ? { isExcluded: false } : { isExcluded: true, reason: verdict.reason };
}

/** The adminNotes line on a paid Order shipped outside the territory: refund it before packing. */
export function outOfTerritoryNote(
  verdict: Extract<TerritoryVerdict, { inTerritory: false }>,
  total: number,
  currency: string
): string {
  return `⚠️ OUT OF TERRITORY: ${verdict.reason} Paid ${currency} $${total.toFixed(2)}. Refund before packing; do not ship.`;
}
