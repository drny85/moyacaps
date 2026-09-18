export function checkIsAdmin(user: any): boolean {
  if (!user) return false;

  // 1. Check Clerk publicMetadata role
  if (user.publicMetadata?.role === "admin" || (user.publicMetadata as any)?.role === "super_admin") {
    return true;
  }

  // 2. Check admin email whitelist from environment
  const adminEmailsRaw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    const userEmails: string[] = [];
    if (user.primaryEmailAddress?.emailAddress) {
      userEmails.push(user.primaryEmailAddress.emailAddress.toLowerCase());
    }
    if (Array.isArray(user.emailAddresses)) {
      user.emailAddresses.forEach((e: any) => {
        if (e.emailAddress) userEmails.push(e.emailAddress.toLowerCase());
      });
    }

    if (userEmails.some((email) => adminEmails.includes(email))) {
      return true;
    }
  }

  // 3. Development fallback: in development, if no explicit whitelist is configured,
  // allow signed-in users or localhost staff
  if (process.env.NODE_ENV === "development" && adminEmails.length === 0) {
    return true;
  }

  return false;
}
