"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";
import { SafeUserProvider } from "@/lib/useSafeUser";

export function ClerkClientProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <SafeUserProvider>{children}</SafeUserProvider>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SafeUserProvider>{children}</SafeUserProvider>
    </ClerkProvider>
  );
}
