"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ClerkProvider, UserButton, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { safeAuthStore } from "@/lib/auth/safeAuthStore";
import { useSafeAuthState } from "@/lib/useSafeUser";

/**
 * The only client module that imports `@clerk/nextjs` (ADR 0018). ClerkClientProvider
 * mounts it lazily beside the page, not around it, so loading Clerk never remounts the
 * page tree. It reports Clerk's state into `safeAuthStore` and portals UserButtons into
 * the slots SafeUserButton reserves.
 */
export default function ClerkRuntime({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkBridge />
      <UserButtonPortals />
    </ClerkProvider>
  );
}

function ClerkBridge() {
  const clerk = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionId, sessionClaims } = useAuth();

  useEffect(() => {
    safeAuthStore.getState().attach({
      openSignIn: (options) => clerk.openSignIn(options),
      redirectToSignIn: ({ forceRedirectUrl, fallbackRedirectUrl, ...rest }) =>
        void clerk.redirectToSignIn({
          ...rest,
          signInForceRedirectUrl: forceRedirectUrl,
          signInFallbackRedirectUrl: fallbackRedirectUrl,
        }),
    });
  }, [clerk]);

  const loaded = Boolean(isLoaded && userLoaded);
  const tokenAudience = typeof sessionClaims?.aud === "string" ? sessionClaims.aud : null;

  useEffect(() => {
    safeAuthStore.getState().setSession({
      isLoaded: loaded,
      isSignedIn: Boolean(loaded && isSignedIn),
      user: user ?? null,
      sessionId: sessionId ?? null,
      orgId: orgId ?? null,
      orgRole: orgRole ?? null,
      tokenAudience,
      getToken,
    });
  }, [loaded, isSignedIn, user, sessionId, orgId, orgRole, tokenAudience, getToken]);

  return null;
}

function UserButtonPortals() {
  const slots = useSafeAuthState((state) => state.userButtonSlots);
  return (
    <>
      {slots.map((slot, i) =>
        createPortal(
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8 sm:w-9 sm:h-9 rounded-xl",
              },
            }}
          />,
          slot,
          String(i)
        )
      )}
    </>
  );
}
