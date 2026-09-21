import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ProductQuickView } from "@/components/product/ProductQuickView";
import { DropAlertModal } from "@/components/drops/DropAlertModal";
import { ProductShareToast } from "@/components/product/ProductShareToast";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ClerkClientProvider } from "@/components/providers/ClerkClientProvider";
import { UserSyncProvider } from "@/components/providers/UserSyncProvider";

import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AdminQuickBar } from "@/components/admin/AdminQuickBar";

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

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <ClerkClientProvider>
          <ConvexClientProvider>
            <UserSyncProvider>
              <SmoothScrollProvider>
                <div className="flex min-h-screen flex-col pb-20 md:pb-0 print:pb-0 print:min-h-0">
                  {/* Film grain noise overlay */}
                  <div className="noise-overlay print:hidden" aria-hidden="true" />
                  <Navbar />
                  <main className="flex-1 print:p-0">{children}</main>
                  <Footer />
                  <MobileActionBar />
                  <CartDrawer />
                  <ProductQuickView />
                  <DropAlertModal />
                  <ProductShareToast />
                  <AdminQuickBar />
                </div>
              </SmoothScrollProvider>
            </UserSyncProvider>
          </ConvexClientProvider>
        </ClerkClientProvider>
    </ThemeProvider>
  </NextIntlClientProvider>
  );
}
