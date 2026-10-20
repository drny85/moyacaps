import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { absoluteUrl, DEFAULT_OG_IMAGE, INSTAGRAM_URL, ogLocale, pageAlternates } from "@/lib/seo/site";

/** Section ids in display order; each needs `about.sections.<id>.heading` and `.body` in both locales. */
const SECTIONS = ["brand", "symbols", "make", "shipping", "contact"] as const;

const linkClass = "font-medium text-moya-red underline underline-offset-2 hover:text-moya-red-light";

/** `<email>` and `<ig>` in the copy become links to support and the brand's Instagram */
const richValues = {
  address: SUPPORT_EMAIL,
  email: (chunks: React.ReactNode) => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
      {chunks}
    </a>
  ),
  ig: (chunks: React.ReactNode) => (
    <a href={INSTAGRAM_URL} target="_blank" rel="me noopener noreferrer" className={linkClass}>
      {chunks}
    </a>
  ),
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const alternates = pageAlternates(locale, "/about");
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      type: "website",
      siteName: "Good Luck",
      locale: ogLocale(locale),
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: title }],
    },
  };
}

/** What 0880 means and who Good Luck is: the brand definition search engines and AI tools quote. */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-[#07070b] pt-28 pb-20 px-4 sm:px-6 transition-colors">
      <article className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <p className="inline-flex px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-moya-red/10 text-moya-red border border-moya-red/20">
            {t("eyebrow")}
          </p>
          <h1 className="font-poster uppercase text-4xl sm:text-6xl text-zinc-900 dark:text-white tracking-tight">{t("title")}</h1>
          <p className="text-base sm:text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">{t("lead")}</p>
        </header>

        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl space-y-8">
          {SECTIONS.map((id) => (
            <section key={id} id={id} className="space-y-3 scroll-mt-28">
              <h2 className="font-display font-bold text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">
                {t(`sections.${id}.heading`)}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{t.rich(`sections.${id}.body`, richValues)}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
