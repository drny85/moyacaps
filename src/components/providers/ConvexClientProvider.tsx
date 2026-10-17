"use client";

import { ReactNode, useCallback, useMemo } from "react";
import { ConvexProvider, ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { fetchConvexToken, safeAuthStore } from "@/lib/auth/safeAuthStore";
import { useSafeAuthState, useSafeConvexAuth } from "@/lib/useSafeUser";

const rawConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const fallbackUrl = "https://placeholder-moyacaps.convex.cloud";

/**
 * Convex auth from the lazily loaded Clerk session (ADR 0018); same token rules as
 * convex/react-clerk's ConvexProviderWithClerk, without importing Clerk here.
 */
function useAuthFromSafeAuth() {
  const { isLoading, isAuthenticated } = useSafeConvexAuth();
  const sessionId = useSafeAuthState((state) => state.session?.sessionId ?? null);
  const orgId = useSafeAuthState((state) => state.session?.orgId ?? null);
  const orgRole = useSafeAuthState((state) => state.session?.orgRole ?? null);

  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      fetchConvexToken(safeAuthStore.getState().session, { forceRefreshToken }),
    // A new function makes Convex call setAuth() again when the session or org changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, orgId, orgRole]
  );

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    return new ConvexReactClient(rawConvexUrl || fallbackUrl);
  }, []);

  const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (hasClerkKey) {
    return (
      <ConvexProviderWithAuth client={client} useAuth={useAuthFromSafeAuth}>
        {children}
      </ConvexProviderWithAuth>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
