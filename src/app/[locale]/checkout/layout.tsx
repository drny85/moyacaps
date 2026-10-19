import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";
import type { Metadata } from "next";

/** Private area: never indexed, even when linked from outside. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Adds the route-scoped message namespaces (src/i18n/clientMessages.ts, ADR 0018) */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
