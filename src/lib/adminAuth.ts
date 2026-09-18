export const PRIMARY_ADMIN_EMAIL = "drny85@gmail.com";
export const PRIMARY_ADMIN_CLERK_ID = "user_3JSsegPcMNMPs5hqmqnpuy8ri6o";

export function checkIsAdmin(user: any): boolean {
  if (!user) return false;

  // 1. Direct match on Clerk ID
  if (user.id === PRIMARY_ADMIN_CLERK_ID) {
    return true;
  }

  // 2. Check primary email and any registered emails
  const emails: string[] = [];
  if (user.primaryEmailAddress?.emailAddress) {
    emails.push(user.primaryEmailAddress.emailAddress.toLowerCase());
  }
  if (Array.isArray(user.emailAddresses)) {
    for (const e of user.emailAddresses) {
      if (e?.emailAddress) {
        emails.push(e.emailAddress.toLowerCase());
      }
    }
  }

  const isPrimaryEmail = emails.includes(PRIMARY_ADMIN_EMAIL.toLowerCase());
  if (isPrimaryEmail) {
    return true;
  }

  // 3. Check Clerk publicMetadata role
  const role = user.publicMetadata?.role || (user.publicMetadata as any)?.role;
  const hasAdminRole = role === "admin" || role === "super_admin";

  // 4. Environment whitelist if configured
  const adminEmailsRaw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isWhitelisted = adminEmails.length > 0 && emails.some((e) => adminEmails.includes(e));

  return hasAdminRole && isWhitelisted;
}

