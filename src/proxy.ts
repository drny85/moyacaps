import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Routes requiring Clerk authentication
const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/:locale/account(.*)",
  "/checkout",
  "/:locale/checkout",
]);

export const proxy = (req: any, ev: any) => {
  // If Clerk publishable key is set, enforce route protection and run intlMiddleware
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
      return intlMiddleware(request);
    })(req, ev);
  }

  return intlMiddleware(req);
};

export default proxy;

export const config = {
  matcher: [
    // Match internationalized routes while ignoring static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
