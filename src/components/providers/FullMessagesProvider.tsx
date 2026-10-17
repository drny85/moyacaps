import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Server component: gives its subtree every message namespace, on top of the storefront
 * subset the locale layout sends (see src/i18n/clientMessages.ts, ADR 0018). Used by the
 * checkout, account, track and admin segment layouts.
 */
export async function FullMessagesProvider({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
