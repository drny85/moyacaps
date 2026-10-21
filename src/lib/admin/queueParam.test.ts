import { describe, expect, it } from "vitest";
import { deskFilterForQueueParam } from "./queueParam";

describe("deskFilterForQueueParam", () => {
  it("maps Home's queue links onto the current desk filters", () => {
    expect(deskFilterForQueueParam("needs_packing")).toBe("needs_attention");
    expect(deskFilterForQueueParam("overdue")).toBe("overdue");
  });

  it("falls back to all for queues the desk cannot filter yet, and for junk", () => {
    expect(deskFilterForQueueParam("problems")).toBe("all");
    expect(deskFilterForQueueParam("nope")).toBe("all");
    expect(deskFilterForQueueParam(null)).toBe("all");
  });
});
