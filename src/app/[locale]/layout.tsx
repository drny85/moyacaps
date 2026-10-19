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
import { HtmlDocument } from "@/components/layout/HtmlDocument";
import { CatalogProvider } from "@/components/providers/CatalogProvider";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { ALL_LIVE, type CategoryLaunches } from "@/lib/launch";
import { toCapVariant } from "@/lib/toCapVariant";
import { api } from "@convex/_generated/api";
import type { CapVariant } from "@/data/caps";
import { shouldSwallowSeedError } from "@/lib/selectCatalog";

// Same interval as the product pages (ADR 0020) so the seeded catalog refreshes with them
export const revalidate = 300;

/**
 * Build time: a failed fetch seeds [] so the build never fails; the live query fills the
 * catalog on the client. Runtime (ISR revalidation): rethrow so Next keeps the last good page.
 */
async function loadCatalogSeed(): Promise<CapVariant[]> {
  try {
    const rows = await queryForStaticRender(api.catalog.queries.getVariants, {});
    return rows.map(toCapVariant);
  } catch (error) {
    if (!shouldSwallowSeedError(process.env.NEXT_PHASE)) throw error;
    console.error("Catalog seed fetch failed; rendering with an empty seed", error);
    return [];
  }
}

/** Category Status for the first render (ADR 0022). Same error policy as the catalog seed. */
async function loadLaunchSeed(): Promise<CategoryLaunches> {
  try {
    return await queryForStaticRender(api.settings.functions.getStorefrontLaunch, {});
  } catch (error) {
    if (!shouldSwallowSeedError(process.env.NEXT_PHASE)) throw error;
    console.error("Launch seed fetch failed; rendering with every category live", error);
    return ALL_LIVE;
  }
}

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
  const [catalogSeed, launchSeed] = await Promise.all([loadCatalogSeed(), loadLaunchSeed()]);

  return (
    <HtmlDocument lang={locale}>
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <ClerkClientProvider>
          <ConvexClientProvider>
            <UserSyncProvider>
              <CatalogProvider seed={catalogSeed} launchSeed={launchSeed}>
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
              </CatalogProvider>
            </UserSyncProvider>
          </ConvexClientProvider>
        </ClerkClientProvider>
    </ThemeProvider>
  </NextIntlClientProvider>
    </HtmlDocument>
  );
}
