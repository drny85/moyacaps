"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  convexAuthView,
  safeAuthStore,
  safeUserView,
  type SafeAuthState,
  type SignInOptions,
} from "@/lib/auth/safeAuthStore";

/**
 * Auth for components (ADR 0018). Nothing here imports `@clerk/nextjs`: Clerk loads
 * lazily in ClerkRuntime and reports into `safeAuthStore`, so these hooks and buttons
 * cost a few hundred bytes on pages where nobody signs in.
 */

/** Whether the current route needs the session to render; set by ClerkClientProvider */
export const RouteNeedsClerkContext = createContext(false);

export function useSafeAuthState<T>(selector: (state: SafeAuthState) => T): T {
  return useStore(safeAuthStore, selector);
}

export function useSafeUser() {
  const routeNeedsClerk = useContext(RouteNeedsClerkContext);
  return useStore(
    safeAuthStore,
    useShallow((state) => safeUserView(state, { routeNeedsClerk }))
  );
}

/** Convex auth state derived from the same store (see ConvexClientProvider) */
export function useSafeConvexAuth() {
  const routeNeedsClerk = useContext(RouteNeedsClerkContext);
  return useStore(
    safeAuthStore,
    useShallow((state) => convexAuthView(state, { routeNeedsClerk }))
  );
}

/** Start loading Clerk ahead of a likely sign-in (hover / focus on a sign-in control) */
export function preloadClerk() {
  safeAuthStore.getState().load();
}

export function SafeSignInButton({
  children,
  mode = "modal",
  ...redirects
}: {
  children: React.ReactElement;
} & SignInOptions) {
  return (
    <Slot
      onPointerEnter={preloadClerk}
      onFocus={preloadClerk}
      onClick={() => safeAuthStore.getState().signIn({ mode, ...redirects })}
    >
      {children}
    </Slot>
  );
}

/**
 * Clerk's UserButton for a signed-in visitor, otherwise `fallback`. The button itself is
 * portaled in by ClerkRuntime (it needs Clerk's context); this reserves its box.
 */
export function SafeUserButton({ fallback }: { fallback?: React.ReactNode }) {
  const { isSignedIn } = useSafeUser();
  const [slot, setSlot] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!slot) return;
    return safeAuthStore.getState().registerUserButtonSlot(slot);
  }, [slot]);

  if (!isSignedIn) return <>{fallback}</>;
  return <span ref={setSlot} className="inline-flex w-8 h-8 sm:w-9 sm:h-9 items-center justify-center" />;
}
