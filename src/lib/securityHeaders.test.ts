import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, convexOrigins, imageRemotePatterns, securityHeaders } from "./securityHeaders.mjs";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
const PROD_CONVEX = "https://clear-malamute-196.convex.cloud";

describe("securityHeaders", () => {
  it("keeps the existing headers and adds a report-only CSP with its report endpoint", () => {
    const keys = securityHeaders({ dev: false }).map((h) => h.key);
    expect(keys).toEqual([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Reporting-Endpoints",
      "Content-Security-Policy-Report-Only",
    ]);
    expect(securityHeaders({ dev: false }).find((h) => h.key === "Reporting-Endpoints")?.value).toBe(
      'csp="/api/csp-report"'
    );
  });

  it("enforces the same policy when enforceCsp is set", () => {
    const reportOnly = securityHeaders({ dev: false, convexUrl: PROD_CONVEX });
    const enforced = securityHeaders({ dev: false, convexUrl: PROD_CONVEX, enforceCsp: true });
    expect(enforced.map((h) => h.key)).toContain("Content-Security-Policy");
    expect(enforced.map((h) => h.key)).not.toContain("Content-Security-Policy-Report-Only");
    expect(enforced.at(-1)?.value).toBe(reportOnly.at(-1)?.value);
  });
});

describe("contentSecurityPolicy", () => {
  it("locks framing, plugins and base URIs", () => {
    const csp = contentSecurityPolicy({ dev: false });
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("allows the services the storefront depends on", () => {
    const csp = contentSecurityPolicy({ dev: false, convexUrl: PROD_CONVEX });
    expect(directive(csp, "connect-src")).toContain("wss://clear-malamute-196.convex.cloud");
    expect(directive(csp, "script-src")).toContain("https://js.stripe.com");
    expect(directive(csp, "script-src")).toContain("https://clerk.goodluckcaps.com");
    expect(directive(csp, "script-src")).toContain("https://cdn.jsdelivr.net");
  });

  it("lets Clerk's bot protection reach its probe hosts on any port", () => {
    const connect = directive(contentSecurityPolicy({ dev: false, convexUrl: PROD_CONVEX }), "connect-src");
    expect(connect.split(" ")).toContain("https://*.client.protect.clerk.com:*");
  });

  it("lets Clerk's bot protection load its bootstrap and loader scripts", () => {
    const scripts = directive(contentSecurityPolicy({ dev: false, convexUrl: PROD_CONVEX }), "script-src").split(" ");
    expect(scripts).toContain("https://cdn.protect.clerk.com");
    expect(scripts).toContain("https://*.client.protect.clerk.com");
  });

  it("allows only this app's Convex deployment, not every Convex customer's", () => {
    const csp = contentSecurityPolicy({ dev: false, convexUrl: PROD_CONVEX });
    expect(csp).not.toContain("*.convex");
    expect(directive(csp, "img-src")).toContain("https://clear-malamute-196.convex.cloud");
    expect(directive(csp, "connect-src")).toContain("https://clear-malamute-196.convex.site");
  });

  it("reports violations to the app's endpoint", () => {
    const csp = contentSecurityPolicy({ dev: false });
    expect(directive(csp, "report-uri")).toBe("report-uri /api/csp-report");
    expect(directive(csp, "report-to")).toBe("report-to csp");
  });

  it("allows eval and the local Convex backend only in dev", () => {
    expect(directive(contentSecurityPolicy({ dev: false }), "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: false }), "connect-src")).not.toContain("127.0.0.1");
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: true }), "connect-src")).toContain("ws://127.0.0.1:3210");
  });
});

describe("convexOrigins", () => {
  it("pins a Convex cloud URL to its deployment, with or without a trailing slash", () => {
    expect(convexOrigins(`${PROD_CONVEX}/`)).toEqual({
      cloud: PROD_CONVEX,
      ws: "wss://clear-malamute-196.convex.cloud",
      site: "https://clear-malamute-196.convex.site",
      hostname: "clear-malamute-196.convex.cloud",
    });
  });

  it("falls back to the wildcards for a missing, local or foreign URL", () => {
    for (const url of [undefined, "", "http://127.0.0.1:3210", "https://evil.example", "https://a.convex.cloud.evil.example"]) {
      expect(convexOrigins(url).hostname).toBeNull();
      expect(convexOrigins(url).cloud).toBe("https://*.convex.cloud");
    }
  });
});

describe("imageRemotePatterns", () => {
  it("allows Clerk avatars and this deployment's storage path only", () => {
    expect(imageRemotePatterns(PROD_CONVEX)).toEqual([
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "clear-malamute-196.convex.cloud", pathname: "/api/storage/**" },
    ]);
  });
});
