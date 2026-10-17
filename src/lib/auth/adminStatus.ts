/**
 * UI admin state from Convex's `users/functions:amIAdmin` (the server's own check),
 * so the client never re-derives admin from Clerk data. `isAdmin` is only true once
 * Convex has confirmed it.
 */
export type AdminStatus = { isAdmin: boolean; isLoading: boolean };

export function adminStatus(
  auth: { isLoading: boolean; isAuthenticated: boolean },
  amIAdmin: boolean | undefined
): AdminStatus {
  if (auth.isLoading) return { isAdmin: false, isLoading: true };
  if (!auth.isAuthenticated) return { isAdmin: false, isLoading: false };
  return { isAdmin: amIAdmin === true, isLoading: amIAdmin === undefined };
}
