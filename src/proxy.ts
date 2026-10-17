import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { routeNeedsClerk } from "./lib/auth/clerkLoadPolicy";
import { shopCategoryRewrite } from "./lib/shopRoutes";

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

  // Shop category views are prerendered under an internal path (ADR 0020); the public
  // URL keeps its `?category=` query.
  const shopTarget = shopCategoryRewrite(req.nextUrl.pathname, req.nextUrl.searchParams.get("category"));
  if (shopTarget) {
    const url = req.nextUrl.clone();
    url.pathname = shopTarget;
    return NextResponse.rewrite(url);
  }

  return intlMiddleware(req);
};

export default proxy;

export const config = {
  matcher: [
    // Match internationalized routes while ignoring static assets, the Try-On face model (public/models), sitemaps, and robots.txt
    "/((?!_next|models/|robots\\.txt|sitemap\\.xml|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
  ],
};
