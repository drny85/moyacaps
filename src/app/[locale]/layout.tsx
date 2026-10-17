import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { pickNamespaces, STOREFRONT_NAMESPACES } from "@/i18n/clientMessages";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ClerkClientProvider } from "@/components/providers/ClerkClientProvider";
import { UserSyncProvider } from "@/components/providers/UserSyncProvider";

import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { DeferredOverlays } from "@/components/layout/DeferredOverlays";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "es")) {
    notFound();
  }
  // Locale from the route, not request headers, so storefront pages can prerender (ADR 0020)
  setRequestLocale(locale);

  // Storefront copy only; auth-area segments add the rest (FullMessagesProvider, ADR 0018)
  const messages = pickNamespaces(await getMessages(), STOREFRONT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <ClerkClientProvider>
          <ConvexClientProvider>
            <UserSyncProvider>
              <SmoothScrollProvider>
                <MotionProvider>
                  <div className="flex min-h-screen flex-col pb-20 md:pb-0 print:pb-0 print:min-h-0">
                    <OrganizationJsonLd />
                    {/* Film grain noise overlay */}
                    <div className="noise-overlay print:hidden" aria-hidden="true" />
                    <Navbar />
                    <main className="flex-1 print:p-0">{children}</main>
                    <Footer />
                    <MobileActionBar />
                    <DeferredOverlays />
                  </div>
                </MotionProvider>
              </SmoothScrollProvider>
            </UserSyncProvider>
          </ConvexClientProvider>
        </ClerkClientProvider>
    </ThemeProvider>
  </NextIntlClientProvider>
  );
}
