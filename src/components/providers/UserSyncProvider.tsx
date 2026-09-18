"use client";

import React, { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSafeUser } from "@/lib/useSafeUser";

function UserSyncInternal({ children }: { children: React.ReactNode }) {
  const { isSignedIn, user } = useSafeUser();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      if (syncedUserRef.current === user.id) return;

      syncCurrentUser()
        .then(() => {
          syncedUserRef.current = user.id;
        })
        .catch((err) => {
          console.error("UserSyncProvider: Failed to sync user to Convex:", err);
        });
    } else if (!isSignedIn) {
      syncedUserRef.current = null;
    }
  }, [isSignedIn, user?.id, syncCurrentUser]);

  return <>{children}</>;
}

export function UserSyncProvider({ children }: { children: React.ReactNode }) {
  // If Convex or Clerk are not configured, render children without attempting sync
  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  return <UserSyncInternal>{children}</UserSyncInternal>;
}
