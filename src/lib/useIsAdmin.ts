"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSafeConvexAuth } from "@/lib/useSafeUser";
import { adminStatus, type AdminStatus } from "@/lib/auth/adminStatus";

/** Whether the signed-in user is an Administrator, as decided by Convex (convex/lib/auth.ts). */
export function useIsAdmin(): AdminStatus {
  const auth = useSafeConvexAuth();
  const amIAdmin = useQuery(api.users.functions.amIAdmin, auth.isAuthenticated ? {} : "skip");
  return adminStatus(auth, amIAdmin);
}
