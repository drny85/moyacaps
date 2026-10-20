import { describe, expect, it } from "vitest";
import {
  generateUnsubscribeToken,
  isUnsubscribeToken,
  launchEmailUnsubscribe,
  listUnsubscribeHeaders,
  oneClickUnsubscribeUrl,
  unsubscribeLocale,
  unsubscribePageUrl,
  UNSUBSCRIBE_TOKEN_BYTES,
} from "./unsubscribe";

const TOKEN = "A".repeat(43);

describe("generateUnsubscribeToken", () => {
  it("encodes 32 random bytes as unpadded base64url", () => {
    // 0xff bytes are "/" in base64, "_" in base64url; the last two bytes end in "8=".
    const token = generateUnsubscribeToken((b) => b.fill(0xff));
    expect(token).toBe(`${"_".repeat(42)}8`);
    expect(isUnsubscribeToken(token)).toBe(true);
  });

  it("asks for exactly UNSUBSCRIBE_TOKEN_BYTES bytes", () => {
    let asked = 0;
    generateUnsubscribeToken((b) => ((asked = b.length), b));
    expect(asked).toBe(UNSUBSCRIBE_TOKEN_BYTES);
  });

  it("uses webcrypto by default: well formed and never repeated", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateUnsubscribeToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(isUnsubscribeToken(token)).toBe(true);
  });
});

describe("isUnsubscribeToken", () => {
  it.each([undefined, null, 42, "", "short", `${TOKEN}A`, `${"A".repeat(42)}=`, `${"A".repeat(42)}+`, `${"A".repeat(42)}/`])(
    "rejects %s",
    (value) => expect(isUnsubscribeToken(value)).toBe(false)
  );
});

describe("unsubscribeLocale", () => {
  it.each([
    ["es", "es"],
    ["en", "en"],
    ["fr", "en"],
    [null, "en"],
    [undefined, "en"],
  ] as const)("%s -> %s", (input, expected) => expect(unsubscribeLocale(input)).toBe(expected));
});

describe("unsubscribe URLs and headers", () => {
  it("links the storefront page in the reader's language", () => {
    expect(unsubscribePageUrl("https://goodluckcaps.com/", "es", TOKEN)).toBe(`https://goodluckcaps.com/es/unsubscribe?token=${TOKEN}`);
  });

  it("points one-click at the Convex route with the locale for the GET redirect", () => {
    expect(oneClickUnsubscribeUrl("https://x.convex.site", "en", TOKEN)).toBe(
      `https://x.convex.site/unsubscribe?token=${TOKEN}&locale=en`
    );
  });

  it("builds RFC 8058 headers", () => {
    expect(listUnsubscribeHeaders("https://x.convex.site/unsubscribe?token=t")).toEqual([
      { name: "List-Unsubscribe", value: "<https://x.convex.site/unsubscribe?token=t>" },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("launch email gets the page link and the one-click headers", () => {
    const out = launchEmailUnsubscribe({ siteUrl: "https://g.com", convexSiteUrl: "https://x.convex.site/", locale: "es", token: TOKEN });
    expect(out.pageUrl).toBe(`https://g.com/es/unsubscribe?token=${TOKEN}`);
    expect(out.headers[0].value).toBe(`<https://x.convex.site/unsubscribe?token=${TOKEN}&locale=es>`);
    expect(out.headers).toHaveLength(2);
  });

  it("omits headers when the Convex site URL is unknown", () => {
    expect(launchEmailUnsubscribe({ siteUrl: "https://g.com", convexSiteUrl: undefined, locale: "en", token: TOKEN }).headers).toEqual([]);
  });
});
