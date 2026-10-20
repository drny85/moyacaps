import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@react-email/render";
import { AdminOrderAlertEmail } from "./templates/AdminOrderAlert";
import { AdminDisputeAlertEmail } from "./templates/AdminDisputeAlert";

// 13:10 UTC on Oct 20, 2026: 9:10 AM at the store.
const NINE_TEN_AM_EDT = Date.UTC(2026, 9, 20, 13, 10);

describe("email dates are in store time, not the server's UTC", () => {
  it("the admin order alert shows when the order was placed in New York time", async () => {
    const html = await render(
      React.createElement(AdminOrderAlertEmail, {
        orderNumber: "GL-1",
        total: 10,
        currency: "USD",
        paymentMethod: "stripe",
        items: [],
        adminDashboardUrl: "https://example.test",
        createdAt: NINE_TEN_AM_EDT,
      })
    );
    expect(html).toContain("Oct 20, 2026, 9:10 AM EDT");
    expect(html).not.toContain("1:10 PM");
  });

  it("the dispute alert shows the evidence deadline in New York time", async () => {
    const html = await render(
      React.createElement(AdminDisputeAlertEmail, {
        orderNumber: "GL-1",
        total: 10,
        currency: "USD",
        disputeId: "dp_1",
        status: "needs_response",
        evidenceDueBy: NINE_TEN_AM_EDT,
        adminDashboardUrl: "https://example.test",
        stripeDisputeUrl: "https://example.test",
        createdAt: NINE_TEN_AM_EDT,
      })
    );
    expect(html).toContain("Oct 20, 2026, 9:10 AM EDT");
  });
});
