import { describe, expect, it } from "vitest";
import { authorizeShippoRequest, parseShippoTracking } from "./shippoWebhook";

const url = (query = "") => new URL(`https://example.convex.site/shippo-webhook${query}`);

describe("authorizeShippoRequest", () => {
  it("refuses everything when no secret is configured", () => {
    expect(authorizeShippoRequest(url("?secret=anything"), new Headers(), undefined)).toBe("unconfigured");
    expect(authorizeShippoRequest(url(), new Headers(), "")).toBe("unconfigured");
  });

  it("accepts the secret from the query string or a secret header", () => {
    expect(authorizeShippoRequest(url("?secret=s3cret"), new Headers(), "s3cret")).toBe("ok");
    expect(authorizeShippoRequest(url(), new Headers({ "x-shippo-secret": "s3cret" }), "s3cret")).toBe("ok");
    expect(authorizeShippoRequest(url(), new Headers({ "x-webhook-secret": "s3cret" }), "s3cret")).toBe("ok");
  });

  it("rejects a missing, wrong or prefix secret", () => {
    expect(authorizeShippoRequest(url(), new Headers(), "s3cret")).toBe("unauthorized");
    expect(authorizeShippoRequest(url("?secret=wrong"), new Headers(), "s3cret")).toBe("unauthorized");
    expect(authorizeShippoRequest(url("?secret=s3cre"), new Headers(), "s3cret")).toBe("unauthorized");
    expect(authorizeShippoRequest(url("?secret="), new Headers(), "s3cret")).toBe("unauthorized");
  });
});

describe("parseShippoTracking", () => {
  it("reads a track_updated body nested under data", () => {
    const parsed = parseShippoTracking({
      event: "track_updated",
      data: {
        tracking_number: " 9400111 ",
        carrier: "usps",
        tracking_status: {
          status: "DELIVERED",
          status_details: "Delivered, In/At Mailbox",
          status_date: "2026-10-21T15:00:00Z",
          location: { city: "Bronx", state: "NY", zip: "10451", country: "US" },
        },
      },
    });
    expect(parsed).toEqual({
      kind: "tracking",
      tracking: {
        trackingNumber: "9400111",
        carrier: "usps",
        status: "DELIVERED",
        statusDetails: "Delivered, In/At Mailbox",
        statusDate: "2026-10-21T15:00:00Z",
        location: { city: "Bronx", state: "NY", zip: "10451", country: "US" },
      },
    });
  });

  it("reads top-level fields and defaults the status to UNKNOWN", () => {
    expect(parseShippoTracking({ tracking_number: 123 })).toEqual({
      kind: "tracking",
      tracking: { trackingNumber: "123", status: "UNKNOWN" },
    });
  });

  it("ignores bodies without a tracking number, and non-object bodies", () => {
    const ignored = { kind: "ignored", reason: "missing_tracking_number" };
    expect(parseShippoTracking({ data: { tracking_status: { status: "DELIVERED" } } })).toEqual(ignored);
    expect(parseShippoTracking(null)).toEqual(ignored);
    expect(parseShippoTracking("DELIVERED")).toEqual(ignored);
    expect(parseShippoTracking({ data: { tracking_number: "   " } })).toEqual(ignored);
  });

  it("drops non-string field types instead of trusting them", () => {
    const parsed = parseShippoTracking({ data: { tracking_number: "1Z", carrier: { evil: true }, tracking_status: { status: ["DELIVERED"] } } });
    expect(parsed).toEqual({ kind: "tracking", tracking: { trackingNumber: "1Z", status: "UNKNOWN" } });
  });
});
