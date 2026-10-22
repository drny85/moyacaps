import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./securityHeaders.mjs";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("securityHeaders", () => {
  it("keeps the existing headers and adds a report-only CSP", () => {
    const keys = securityHeaders({ dev: false }).map((h) => h.key);
    expect(keys).toEqual([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy-Report-Only",
    ]);
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
    const csp = contentSecurityPolicy({ dev: false });
    expect(directive(csp, "connect-src")).toContain("wss://*.convex.cloud");
    expect(directive(csp, "script-src")).toContain("https://js.stripe.com");
    expect(directive(csp, "script-src")).toContain("https://clerk.goodluckcaps.com");
    expect(directive(csp, "script-src")).toContain("https://cdn.jsdelivr.net");
  });

  it("allows eval and the local Convex backend only in dev", () => {
    expect(directive(contentSecurityPolicy({ dev: false }), "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: false }), "connect-src")).not.toContain("127.0.0.1");
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: true }), "connect-src")).toContain("ws://127.0.0.1:3210");
  });
});
