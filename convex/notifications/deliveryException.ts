/**
 * Copy for the Delivery Exception / returned-to-sender emails (CONTEXT.md "Delivery Exception"):
 * the Administrator is asked to Reship or refund; the Customer is told we are on it. Pure;
 * covered by deliveryException.test.ts.
 */

export type DeliveryProblem = "delivery_exception" | "returned";
export type EmailAudience = "administrator" | "customer";

export type DeliveryExceptionCopy = {
  subject: string;
  badge: string;
  heading: string;
  body: string;
};

export function deliveryExceptionCopy(
  kind: DeliveryProblem,
  audience: EmailAudience,
  orderNumber: string
): DeliveryExceptionCopy {
  const returned = kind === "returned";
  if (audience === "administrator") {
    return {
      subject: returned
        ? `↩️ [Returned to sender] Order #${orderNumber} needs a Reship or refund`
        : `⚠️ [Delivery exception] Order #${orderNumber} needs a Reship or refund`,
      badge: returned ? "RETURNED TO SENDER" : "DELIVERY EXCEPTION",
      heading: returned ? "Package returned to sender" : "The carrier could not deliver",
      body: "Open the order, confirm the address with the Customer, then Reship it (a new label on the same order) or refund it.",
    };
  }
  return {
    subject: returned
      ? `Your Good Luck order #${orderNumber} is coming back to us`
      : `A delivery problem with your Good Luck order #${orderNumber}`,
    badge: returned ? "RETURNED TO SENDER" : "DELIVERY UPDATE",
    heading: returned ? "Your package is on its way back to us" : "The carrier couldn't deliver your package",
    body: "We're on it. Our team will contact you to confirm your address and either send it again or refund you. Write to us at orders@goodluckcaps.com if anything changed.",
  };
}
