export type SetAdminRequest = {
  target: { clerkId: string } | { email: string };
  role: "admin" | "customer";
  prod: boolean;
};

export const SET_ADMIN_USAGE = "Usage: bun run set-admin <email | user_xxx> [--revoke] [--prod]";

/** Parse `set-admin` CLI args. A target starting with `user_` is a Clerk ID, anything else an email. */
export function parseSetAdminArgs(argv: string[]): SetAdminRequest {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const unknown = [...flags].filter((f) => f !== "--revoke" && f !== "--prod");
  if (positional.length !== 1 || unknown.length > 0) {
    throw new Error(SET_ADMIN_USAGE);
  }
  const raw = positional[0].trim();
  const target = raw.startsWith("user_") ? { clerkId: raw } : { email: raw.toLowerCase() };
  if ("email" in target && !target.email.includes("@")) {
    throw new Error(SET_ADMIN_USAGE);
  }
  return { target, role: flags.has("--revoke") ? "customer" : "admin", prod: flags.has("--prod") };
}
