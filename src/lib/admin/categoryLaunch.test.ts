import { describe, expect, it } from "vitest";
import { launchChatUrl, launchWhatsAppText, listedCount, needsLaunchConfirm } from "./categoryLaunch";

describe("needsLaunchConfirm", () => {
  it("is true only when leaving live", () => {
    expect(needsLaunchConfirm("live", "coming_soon")).toBe(true);
    expect(needsLaunchConfirm("live", "hidden")).toBe(true);
    expect(needsLaunchConfirm("live", "live")).toBe(false);
    expect(needsLaunchConfirm("coming_soon", "live")).toBe(false);
    expect(needsLaunchConfirm("hidden", "coming_soon")).toBe(false);
  });
});

describe("listedCount", () => {
  const row = (o: Partial<{ category: string; silhouette: string; isAvailable: boolean; archivedAt: number }>) => ({
    silhouette: "snapback",
    isAvailable: true,
    ...o,
  });

  it("counts visible, unarchived products of the category", () => {
    const rows = [
      row({ category: "headwear" }),
      row({}), // no category counts as a cap
      row({ category: "headwear", isAvailable: false }),
      row({ category: "headwear", archivedAt: 1 }),
      row({ category: "apparel", silhouette: "tee" }),
      row({ silhouette: "tee" }), // legacy tee without category
    ];
    expect(listedCount(rows, "headwear")).toBe(2);
    expect(listedCount(rows, "apparel")).toBe(2);
  });
});

describe("launchChatUrl", () => {
  it("opens a WhatsApp chat with the digits of the number and an encoded message", () => {
    expect(launchChatUrl("+1 (555) 123-4567", "Tees are live!")).toBe("https://wa.me/15551234567?text=Tees%20are%20live!");
  });
});

describe("launchWhatsAppText", () => {
  it("is written in the subscriber's language", () => {
    expect(launchWhatsAppText("en", "apparel", "https://goodluckcaps.com")).toBe(
      "Hi! Good Luck here. The tees you asked about just dropped: https://goodluckcaps.com/en/products?category=tees"
    );
    expect(launchWhatsAppText("es", "headwear", "https://goodluckcaps.com")).toBe(
      "¡Hola! Te escribimos de Good Luck. Ya salieron las gorras que esperabas: https://goodluckcaps.com/es/products?category=caps"
    );
  });
});
