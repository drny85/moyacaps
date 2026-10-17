import { AdminConsoleLayout } from "@/components/admin/AdminConsoleLayout";
import { FullMessagesProvider } from "@/components/providers/FullMessagesProvider";

/** Server wrapper: adds the admin message namespaces (ADR 0018) around the client console shell */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <FullMessagesProvider>
      <AdminConsoleLayout>{children}</AdminConsoleLayout>
    </FullMessagesProvider>
  );
}
