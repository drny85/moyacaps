import { describe, expect, it } from "vitest";
import { actorLabel, toTimelineRow } from "./orderTimeline";

describe("toTimelineRow", () => {
  it("names known events and scans", () => {
    expect(toTimelineRow({ at: 1, source: "event", kind: "handoff_recorded", details: "Package dropped off with USPS", actor: "user_abc" }, 0)).toMatchObject({
      title: "Handed off to the carrier",
      tone: "blue",
      details: "Package dropped off with USPS",
      meta: "Administrator",
    });
    expect(toTimelineRow({ at: 1, source: "scan", kind: "TRANSIT", details: "Out for Delivery", location: "Bronx, NY" }, 0)).toMatchObject({
      title: "Carrier: out for delivery",
      meta: "Bronx, NY",
    });
  });

  it("leaves out machine payloads and the system actor", () => {
    const row = toTimelineRow({ at: 1, source: "event", kind: "stripe_settled", details: '{"total":160}', actor: "system" }, 0);
    expect(row.details).toBeUndefined();
    expect(row.meta).toBe("");
  });

  it("falls back to the event's own words", () => {
    expect(toTimelineRow({ at: 1, source: "event", kind: "some_new_event" }, 0).title).toBe("Some new event");
    expect(toTimelineRow({ at: 1, source: "scan", kind: "HELD" }, 0).title).toBe("Carrier: held");
  });
});

describe("actorLabel", () => {
  it("names who did it", () => {
    expect(actorLabel("user_123")).toBe("Administrator");
    expect(actorLabel("courier_webhook")).toBe("Carrier");
    expect(actorLabel(undefined)).toBe("");
  });
});
