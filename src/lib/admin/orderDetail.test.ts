import { describe, expect, it } from "vitest";
import { toOrderDetail } from "./orderDetail";
import type { DetailOrderInput, PackingProductInput } from "./orderDetail";

const NOW = Date.UTC(2026, 9, 17, 12);
const money = (n: number, locale: "en" | "es" = "en") => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

const products: PackingProductInput[] = [
  { variantId: "0880-black", nameEn: "0880 Black", nameEs: "0880 Negro", category: "headwear", image: "/cap.png", catalogShot: "/cap-shot.png", images: ["/cap-life.png"] },
  {
    variantId: "gothic-skull",
    nameEn: "Gothic Skull",
    nameEs: "Calavera Gótica",
    category: "apparel",
    image: "",
    colorways: [{ id: "white", nameEn: "Crisp White", nameEs: "Blanco", catalogShot: "/tee-white-shot.png", lifestyleImage: "/tee-white-life.png" }],
  },
];

const order: DetailOrderInput = {
  _id: "o1",
  orderNumber: "GL-1042",
  createdAt: NOW - 3 * 60 * 60 * 1000,
  currency: "USD",
  customerName: "Ana López",
  customerEmail: "ana@example.com",
  customerPhone: "+1 555 0100",
  shippingAddress: { line1: "1 Main St", line2: "Apt 2", city: "Austin", state: "TX", postalCode: "78701", country: "US" },
  items: [
    { variantId: "0880-black", name: "Black cap (stored)", quantity: 2, price: 45, image: "/stored-cap.png" },
    { variantId: "gothic-skull", name: "Gothic Skull Tee", quantity: 1, price: 60, image: "/stored-tee.png", colorway: "white", size: "M" },
  ],
  subtotal: 150,
  shippingFee: 0,
  tax: 12.38,
  taxDetails: { rate: 8.25 },
  total: 162.38,
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  paymentMethod: "stripe",
  stripeSessionId: "cs_1",
};

describe("toOrderDetail", () => {
  const vm = toOrderDetail(order, products, "en", NOW);

  it("joins a cap line to its Catalog Shot and Lifestyle Shot, keeping the slug", () => {
    expect(vm.items[0]).toMatchObject({ key: "0880-black", name: "0880 Black", slug: "0880-black", quantity: 2, image: "/cap-shot.png", lifestyleImage: "/cap-life.png", archived: false });
    expect(vm.items[0].colorway).toBeUndefined();
    expect(vm.items[0].lineLabel).toBe(money(90));
    expect(vm.items[0].unitLabel).toBe(money(45));
  });

  it("joins a tee line to its Apparel Colorway's shots, naming the colorway by locale", () => {
    expect(vm.items[1]).toMatchObject({ key: "gothic-skull/white/M", name: "Gothic Skull", image: "/tee-white-shot.png", lifestyleImage: "/tee-white-life.png", colorway: "Crisp White", size: "M" });
    expect(toOrderDetail(order, products, "es", NOW).items[1]).toMatchObject({ name: "Calavera Gótica", colorway: "Blanco" });
  });

  it("a colorway no longer on the product falls back to the stored image and id", () => {
    const changed = products.map((p) => (p.variantId === "gothic-skull" ? { ...p, colorways: [] } : p));
    expect(toOrderDetail(order, changed, "en", NOW).items[1]).toMatchObject({ image: "/stored-tee.png", lifestyleImage: undefined, colorway: "white", archived: false });
  });

  it("a line with no product row is archived and keeps the stored name and image", () => {
    expect(toOrderDetail(order, [], "en", NOW).items[0]).toMatchObject({ name: "Black cap (stored)", image: "/stored-cap.png", archived: true });
    expect(toOrderDetail(order, undefined, "en", NOW).items).toHaveLength(2);
  });

  it("counts units and builds the header", () => {
    expect(vm.itemCount).toBe(3);
    expect(vm.header).toMatchObject({ orderNumber: "GL-1042", age: { value: 3, unit: "h" }, disputed: false, cancelled: false });
    expect(vm.header.lifecycle).toEqual({ paymentStatus: "paid", fulfillmentStatus: "unfulfilled", cancelledAt: undefined });
  });

  it("money: free shipping, tax rate, refunded line, Total Paid vs Total Due", () => {
    expect(vm.money).toEqual({ subtotalLabel: money(150), shippingLabel: "free", taxLabel: money(12.38), taxRate: 8.25, refundedLabel: undefined, totalLabel: money(162.38), paid: true });
    const due = toOrderDetail({ ...order, paymentStatus: "awaiting_payment", shippingFee: 8, refundedAmount: 0, tax: undefined, taxDetails: undefined }, products, "en", NOW).money;
    expect(due).toMatchObject({ shippingLabel: money(8), taxLabel: undefined, paid: false });
    expect(toOrderDetail({ ...order, refundedAmount: 20 }, products, "en", NOW).money.refundedLabel).toBe(money(20));
  });

  it("shipTo is editable only until a label exists, and flags a missing address", () => {
    expect(vm.shipTo).toEqual({ name: "Ana López", email: "ana@example.com", phone: "+1 555 0100", lines: ["1 Main St", "Apt 2", "Austin, TX 78701", "US"], editable: true, missing: false });
    expect(toOrderDetail({ ...order, fulfillmentStatus: "label_purchased" }, products, "en", NOW).shipTo.editable).toBe(false);
    expect(toOrderDetail({ ...order, shippingAddress: undefined }, products, "en", NOW).shipTo).toMatchObject({ lines: [], missing: true });
  });

  it("labels: tracking url for USPS, none without a label", () => {
    expect(vm.labels).toEqual({ carrier: undefined, trackingNumber: undefined, trackingUrl: null, labelUrl: undefined, manualOverride: false, manualAllowed: true, handoffEditable: false });
    const shipped = toOrderDetail({ ...order, fulfillmentStatus: "in_transit", carrier: "USPS", trackingNumber: "9400111", shippingLabelUrl: "https://l/1.pdf", manualStatusOverride: true }, products, "en", NOW).labels;
    expect(shipped).toMatchObject({ carrier: "USPS", trackingNumber: "9400111", labelUrl: "https://l/1.pdf", manualOverride: true });
    expect(shipped.trackingUrl).toContain("usps.com");
  });

  it("labels: the Handoff is shown, and editable only while Ready to Ship (ADR 0030)", () => {
    const label = { carrier: "USPS", trackingNumber: "9400111", labelUrl: "u", purchasedAt: NOW, reship: false };
    const handoff = { method: "dropped_off" as const, at: NOW, note: "5th Ave", recordedAt: NOW, actor: "a" };
    const ready = toOrderDetail({ ...order, fulfillmentStatus: "label_purchased", labels: [{ ...label, handoff }] }, products, "en", NOW).labels;
    expect(ready.handoff).toEqual({ method: "dropped_off", at: NOW, note: "5th Ave" });
    expect(ready.handoffEditable).toBe(true);
    const scanned = toOrderDetail({ ...order, fulfillmentStatus: "in_transit", labels: [{ ...label, handoff }] }, products, "en", NOW).labels;
    expect(scanned.handoffEditable).toBe(false);
  });

  it("manual tracking is offered only for a paid order with no carrier label, never once cancelled", () => {
    expect(toOrderDetail({ ...order, trackingNumber: "9400111", carrier: "USPS" }, products, "en", NOW).labels.manualAllowed).toBe(false);
    expect(toOrderDetail({ ...order, paymentStatus: "awaiting_payment" }, products, "en", NOW).labels.manualAllowed).toBe(false);
    expect(toOrderDetail({ ...order, cancelledAt: NOW }, products, "en", NOW).labels.manualAllowed).toBe(false);
    expect(toOrderDetail({ ...order, trackingNumber: "GL-TRK-legacy" }, products, "en", NOW).labels.manualAllowed).toBe(true);
  });

  it("danger: refundable only for Stripe orders with a session; cancel only once", () => {
    expect(vm.danger).toEqual({ canCancel: true, refundable: true });
    expect(toOrderDetail({ ...order, stripeSessionId: undefined }, products, "en", NOW).danger.refundable).toBe(false);
    expect(toOrderDetail({ ...order, paymentStatus: "awaiting_payment" }, products, "en", NOW).danger.refundable).toBe(false);
    expect(toOrderDetail({ ...order, cancelledAt: NOW }, products, "en", NOW).danger.canCancel).toBe(false);
  });

  it("passes notes through", () => {
    expect(vm.notes).toBe("");
    expect(toOrderDetail({ ...order, adminNotes: "Gift wrap" }, products, "en", NOW).notes).toBe("Gift wrap");
  });
});
