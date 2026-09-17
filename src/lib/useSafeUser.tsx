"use client";

import React, { createContext, useContext } from "react";
import {
  useUser as useClerkUser,
  SignInButton as ClerkSignInButton,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";

interface SafeUserContextType {
  user: any;
  isLoaded: boolean;
  isSignedIn: boolean;
}

const SafeUserContext = createContext<SafeUserContextType>({
  user: null,
  isLoaded: true,
  isSignedIn: false,
});

function RealClerkUserBridge({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useClerkUser();
  return (
    <SafeUserContext.Provider value={{ user, isLoaded, isSignedIn: Boolean(isSignedIn) }}>
      {children}
    </SafeUserContext.Provider>
  );
}

export function SafeUserProvider({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <RealClerkUserBridge>{children}</RealClerkUserBridge>;
  }
  return (
    <SafeUserContext.Provider value={{ user: null, isLoaded: true, isSignedIn: false }}>
      {children}
    </SafeUserContext.Provider>
  );
}

export function useSafeUser() {
  return useContext(SafeUserContext);
}

export function SafeSignInButton({
  children,
  mode = "modal",
  forceRedirectUrl,
  fallbackRedirectUrl,
  signUpForceRedirectUrl,
  signUpFallbackRedirectUrl,
}: {
  children: React.ReactNode;
  mode?: "modal" | "redirect";
  forceRedirectUrl?: string;
  fallbackRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
  signUpFallbackRedirectUrl?: string;
}) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkSignInButton
        mode={mode}
        forceRedirectUrl={forceRedirectUrl}
        fallbackRedirectUrl={fallbackRedirectUrl}
        signUpForceRedirectUrl={signUpForceRedirectUrl}
        signUpFallbackRedirectUrl={signUpFallbackRedirectUrl}
      >
        {children}
      </ClerkSignInButton>
    );
  }
  return <>{children}</>;
}

export function SafeUserButton({ fallback }: { fallback?: React.ReactNode }) {
  const { isSignedIn } = useSafeUser();
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && isSignedIn) {
    return (
      <ClerkUserButton
        appearance={{
          elements: {
            userButtonAvatarBox: "w-8 h-8 sm:w-9 sm:h-9 rounded-xl",
          },
        }}
      />
    );
  }
  return <>{fallback}</>;
}


