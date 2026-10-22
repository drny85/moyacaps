import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminConsoleLayout } from "@/components/admin/AdminConsoleLayout";
import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";
import { adminGate } from "@/lib/server/adminGate";
import { api } from "../../../../convex/_generated/api";

/** Private area: never indexed, even when linked from outside. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Server wrapper: checks with Convex that the visitor is an Administrator before any console UI
 * renders, then adds the admin message namespaces (ADR 0018) around the client console shell.
 * Non-Administrators get a 404, so the console's existence is not advertised.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const gate = await adminGate({
    userId: session.userId,
    getConvexToken: () => session.getToken({ template: "convex" }),
    amIAdmin: (token) => fetchQuery(api.users.functions.amIAdmin, {}, { token }),
  });
  if (gate === "sign_in") return session.redirectToSignIn();
  if (gate === "deny") notFound();

  return (
    <FullMessagesProvider>
      <AdminConsoleLayout>{children}</AdminConsoleLayout>
    </FullMessagesProvider>
  );
}
