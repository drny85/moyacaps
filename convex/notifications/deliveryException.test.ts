import { describe, expect, it } from "vitest";
import { deliveryExceptionCopy } from "./deliveryException";

describe("delivery exception emails", () => {
  it("asks the Administrator to Reship or refund", () => {
    const exception = deliveryExceptionCopy("delivery_exception", "administrator", "GL-1");
    expect(exception.subject).toContain("#GL-1");
    expect(exception.subject).toContain("Delivery exception");
    expect(exception.body).toMatch(/Reship/);
    expect(exception.body).toMatch(/refund/);
    expect(deliveryExceptionCopy("returned", "administrator", "GL-1").badge).toBe("RETURNED TO SENDER");
  });

  it("tells the Customer what happens next without internal terms", () => {
    for (const kind of ["delivery_exception", "returned"] as const) {
      const copy = deliveryExceptionCopy(kind, "customer", "GL-2");
      expect(copy.subject).toContain("#GL-2");
      expect(copy.body).not.toMatch(/Reship|Administrator/);
      expect(copy.body).toMatch(/send it again or refund/);
    }
  });
});
