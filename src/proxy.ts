import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export const proxy = (req: any, ev: any) => {
  // If Clerk publishable key is set, run clerkMiddleware; otherwise fallback to intlMiddleware
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return clerkMiddleware(async (auth, request) => {
      return intlMiddleware(request);
    })(req, ev);
  }

  return intlMiddleware(req);
};

export default proxy;

export const config = {
  matcher: [
    // Match internationalized routes while ignoring static assets and API routes
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
