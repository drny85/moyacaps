"use client";

import { ReactNode, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { clerkLoadTrigger, routeNeedsClerk } from "@/lib/auth/clerkLoadPolicy";
import { safeAuthStore } from "@/lib/auth/safeAuthStore";
import { RouteNeedsClerkContext, useSafeAuthState } from "@/lib/useSafeUser";
import { whenIdle } from "@/lib/deferred";

const ClerkRuntime = dynamic(() => import("./clerk/ClerkRuntime"), { ssr: false });

/**
 * Loads Clerk only when it is needed (ADR 0018): immediately on auth routes, after
 * idle for visitors with a Clerk session cookie, and otherwise on the first sign-in
 * intent. The page renders as children; Clerk mounts beside it.
 */
export function ClerkClientProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const pathname = usePathname();
  const needsClerk = Boolean(publishableKey) && routeNeedsClerk(pathname);

  return (
    <RouteNeedsClerkContext.Provider value={needsClerk}>
      {children}
      {publishableKey && <ClerkLoader pathname={pathname} publishableKey={publishableKey} />}
    </RouteNeedsClerkContext.Provider>
  );
}

function ClerkLoader({ pathname, publishableKey }: { pathname: string; publishableKey: string }) {
  const requested = useSafeAuthState((state) => state.requested);

  useEffect(() => {
    if (requested) return;
    const trigger = clerkLoadTrigger({ pathname, cookie: document.cookie });
    const { load, setHinted } = safeAuthStore.getState();
    if (trigger === "now") {
      load();
    } else if (trigger === "idle") {
      setHinted(true);
      return whenIdle(load);
    }
  }, [pathname, requested]);

  return requested ? <ClerkRuntime publishableKey={publishableKey} /> : null;
}
