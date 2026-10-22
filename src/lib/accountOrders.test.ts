import { describe, expect, it } from "vitest";
import { addressFormDefaults, conciergeMessage, orderActionNote } from "./accountOrders";

describe("orderActionNote", () => {
  const none = { isCancellable: false, isShipped: false, canEditAddress: false };

  it("prefers cancellable over every other state", () => {
    expect(orderActionNote({ isCancellable: true, isShipped: true, canEditAddress: true })).toBe("cancellable");
  });

  it("says shipped before awaiting dispatch", () => {
    expect(orderActionNote({ ...none, isShipped: true, canEditAddress: true })).toBe("shipped");
  });

  it("says awaiting dispatch when only the address is editable", () => {
    expect(orderActionNote({ ...none, canEditAddress: true })).toBe("awaitingDispatch");
  });

  it("falls back to finalized", () => {
    expect(orderActionNote(none)).toBe("finalized");
  });
});

describe("addressFormDefaults", () => {
  it("copies the current address and phone", () => {
    expect(
      addressFormDefaults({
        shippingAddress: { line1: "1 Main St", line2: "APT 4B", city: "Bronx", state: "NY", postalCode: "10451", country: "US" },
        customerPhone: "+15550000000",
      }),
    ).toEqual({
      line1: "1 Main St",
      line2: "APT 4B",
      city: "Bronx",
      state: "NY",
      postalCode: "10451",
      customerPhone: "+15550000000",
      country: "US",
    });
  });

  it("starts blank in the US without an address", () => {
    expect(addressFormDefaults({})).toEqual({
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      customerPhone: "",
      country: "US",
    });
  });
});

describe("conciergeMessage", () => {
  it("names the order and the request in English", () => {
    expect(conciergeMessage("en", "GL-1", "return")).toContain("Order #GL-1 (Exchange/Return)");
    expect(conciergeMessage("en", "GL-1", "support")).toContain("(Tracking/Delivery)");
  });

  it("writes Spanish for es", () => {
    expect(conciergeMessage("es", "GL-1", "return")).toContain("orden #GL-1 (Cambio/Devolución)");
  });
});
