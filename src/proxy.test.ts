/**
 * Request routing order in proxy.ts (security review L8): Clerk only on routes that read the
 * session, then the Shop category rewrite, then next-intl for everything else.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";

const calls = vi.hoisted(() => ({ clerk: [] as string[], intl: [] as string[] }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: (auth: unknown, req: NextRequest) => Response) => (req: NextRequest) => {
    calls.clerk.push(req.nextUrl.pathname);
    return handler({}, req);
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: () => (req: NextRequest) => {
    calls.intl.push(req.nextUrl.pathname);
    return new Response(null, { headers: { "x-handled-by": "intl" } });
  },
}));

// routing.ts also builds next-intl navigation helpers, which need the Next runtime.
vi.mock("./i18n/routing", async () => ({ routing: (await import("./i18n/config")).routing }));

const { proxy } = await import("./proxy");

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
const run = (path: string) => proxy(request(path), {} as NextFetchEvent) as Response;

beforeEach(() => {
  calls.clerk.length = 0;
  calls.intl.length = 0;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_proxy";
});

describe("proxy", () => {
  it("runs Clerk, then next-intl, on routes that read the session", () => {
    for (const path of ["/en/admin", "/es/admin/orders", "/en/checkout", "/en/account/orders"]) {
      run(path);
    }
    expect(calls.clerk).toEqual(["/en/admin", "/es/admin/orders", "/en/checkout", "/en/account/orders"]);
    expect(calls.intl).toEqual(calls.clerk);
  });

  it("skips Clerk on public pages", () => {
    run("/en");
    run("/en/products/negro-rojo");
    expect(calls.clerk).toEqual([]);
    expect(calls.intl).toEqual(["/en", "/en/products/negro-rojo"]);
  });

  it("rewrites a Shop category view to its prerendered path without next-intl", () => {
    const res = run("/en/products?category=tees");
    expect(new URL(res.headers.get("x-middleware-rewrite")!).pathname).toBe("/en/products/category/tees");
    expect(calls.intl).toEqual([]);
    run("/en/products?category=socks");
    expect(calls.intl).toEqual(["/en/products"]);
  });

  it("skips Clerk everywhere when no publishable key is configured", () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    run("/en/admin");
    expect(calls.clerk).toEqual([]);
    expect(calls.intl).toEqual(["/en/admin"]);
  });
});
