import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";

/** Adds the route-scoped message namespaces (src/i18n/clientMessages.ts, ADR 0018) */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
