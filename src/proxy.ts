import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { routeNeedsClerk } from "./lib/auth/clerkLoadPolicy";

const intlMiddleware = createMiddleware(routing);

const clerkAndIntl = clerkMiddleware((_auth, request) => intlMiddleware(request));

export const proxy = (req: NextRequest, ev: NextFetchEvent) => {
  // Clerk's middleware only runs where the session matters (ADR 0018). On public pages it
  // would add a handshake redirect round trip for visitors without Clerk cookies (always on
  // development instances) while no server code there reads the session; clerk-js
  // manages the session client-side when it loads.
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && routeNeedsClerk(req.nextUrl.pathname)) {
    return clerkAndIntl(req, ev);
  }

  return intlMiddleware(req);
};

export default proxy;

export const config = {
  matcher: [
    // Match internationalized routes while ignoring static assets, sitemaps, and robots.txt
    "/((?!_next|robots\\.txt|sitemap\\.xml|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
  ],
};
