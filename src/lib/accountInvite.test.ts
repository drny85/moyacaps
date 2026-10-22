import { describe, expect, it } from "vitest";
import { accountOrdersPath, confirmationAccountOffer } from "./accountInvite";

describe("confirmationAccountOffer", () => {
  it("offers nothing until Clerk answers", () => {
    expect(confirmationAccountOffer({ isLoaded: false, isSignedIn: false })).toBe("none");
  });

  it("shows a signed-in Customer their orders", () => {
    expect(confirmationAccountOffer({ isLoaded: true, isSignedIn: true })).toBe("viewOrders");
  });

  it("invites a signed-out visitor to create an account", () => {
    expect(confirmationAccountOffer({ isLoaded: true, isSignedIn: false })).toBe("accountInvite");
  });
});

describe("accountOrdersPath", () => {
  it("keeps the locale", () => {
    expect(accountOrdersPath("es")).toBe("/es/account/orders");
  });
});
