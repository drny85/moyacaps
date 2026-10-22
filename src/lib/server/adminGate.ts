/**
 * Server-side gate for the admin console (security review L2). Data was already safe (every
 * admin Convex function calls requireAdmin), but the console's UI and bundle reached anyone
 * who opened /admin. Pure: the layout passes in how to read the session and ask Convex.
 */
export type AdminGate = "sign_in" | "deny" | "allow";

export async function adminGate(deps: {
  userId: string | null;
  getConvexToken: () => Promise<string | null>;
  amIAdmin: (token: string) => Promise<boolean>;
}): Promise<AdminGate> {
  if (!deps.userId) return "sign_in";
  const token = await deps.getConvexToken();
  if (!token) return "deny";
  return (await deps.amIAdmin(token)) ? "allow" : "deny";
}
