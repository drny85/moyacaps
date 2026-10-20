import { describe, expect, it } from "vitest";
import { formatStoreDate, formatStoreDateTime, STORE_TIME_ZONE } from "./storeTime";

describe("store time", () => {
  it("is New York time", () => {
    expect(STORE_TIME_ZONE).toBe("America/New_York");
  });

  it("shows a summer instant in EDT, not the server's UTC", () => {
    // 13:10 UTC on Oct 20, 2026 is 9:10 AM in New York.
    expect(formatStoreDateTime(Date.UTC(2026, 9, 20, 13, 10))).toBe("Oct 20, 2026, 9:10 AM EDT");
  });

  it("shows a winter instant in EST", () => {
    // 14:10 UTC on Jan 15, 2026 is 9:10 AM in New York.
    expect(formatStoreDateTime(Date.UTC(2026, 0, 15, 14, 10))).toBe("Jan 15, 2026, 9:10 AM EST");
  });

  it("gives the New York calendar day for a late-evening instant", () => {
    // 02:30 UTC on Oct 21 is still the evening of Oct 20 in New York (EDT).
    expect(formatStoreDate(Date.UTC(2026, 9, 21, 2, 30))).toBe("Oct 20, 2026");
    // 03:30 UTC on Jan 16 is still Jan 15 in New York (EST).
    expect(formatStoreDate(Date.UTC(2026, 0, 16, 3, 30))).toBe("Jan 15, 2026");
  });
});
