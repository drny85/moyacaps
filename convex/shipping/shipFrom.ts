/**
 * The ship-from (return) address printed on every label. It lives in the Convex deployment's
 * environment, never in the repository: `npx convex env set SHIP_FROM_STREET1 "…"` (and the rest
 * below) on dev and prod. Pure; covered by shipFrom.test.ts.
 */

export const SHIP_FROM_ENV = {
  required: [
    "SHIP_FROM_NAME",
    "SHIP_FROM_STREET1",
    "SHIP_FROM_CITY",
    "SHIP_FROM_STATE",
    "SHIP_FROM_ZIP",
    "SHIP_FROM_PHONE",
    "SHIP_FROM_EMAIL",
  ],
  optional: ["SHIP_FROM_COMPANY", "SHIP_FROM_STREET2", "SHIP_FROM_COUNTRY"],
} as const;

export type ShipFromAddress = {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  /** Ten digits, as Shippo wants them. */
  phone: string;
  email: string;
};

export type ShipFromResult = { ok: true; address: ShipFromAddress } | { ok: false; missing: string[] };

type Env = Record<string, string | undefined>;

const value = (env: Env, key: string): string | undefined => {
  const v = env[key]?.trim();
  return v ? v : undefined;
};

export function parseShipFrom(env: Env): ShipFromResult {
  const missing: string[] = SHIP_FROM_ENV.required.filter((key) => value(env, key) === undefined);
  const phone = (value(env, "SHIP_FROM_PHONE") ?? "").replace(/\D/g, "").slice(-10);
  if (value(env, "SHIP_FROM_PHONE") !== undefined && phone.length !== 10) missing.push("SHIP_FROM_PHONE");
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    address: {
      name: value(env, "SHIP_FROM_NAME")!,
      company: value(env, "SHIP_FROM_COMPANY"),
      street1: value(env, "SHIP_FROM_STREET1")!,
      street2: value(env, "SHIP_FROM_STREET2"),
      city: value(env, "SHIP_FROM_CITY")!,
      state: value(env, "SHIP_FROM_STATE")!,
      zip: value(env, "SHIP_FROM_ZIP")!,
      country: value(env, "SHIP_FROM_COUNTRY") ?? "US",
      phone,
      email: value(env, "SHIP_FROM_EMAIL")!,
    },
  };
}

/** A clear refusal for the label modal when the deployment has not been configured. */
export function shipFromMissingMessage(missing: string[]): string {
  return `The ship-from address is not configured. Set ${missing.join(", ")} on the Convex deployment (npx convex env set).`;
}
