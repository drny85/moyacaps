import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FileText, ShieldCheck } from "lucide-react";
import { countItems, formatLastUpdated, LEGAL_SECTIONS, SUPPORT_EMAIL, type LegalDocument } from "@/lib/legal";
import { absoluteUrl, DEFAULT_OG_IMAGE, ogLocale, pageAlternates } from "@/lib/seo/site";

const ICONS = { terms: FileText, privacy: ShieldCheck } as const;

export async function legalMetadata(locale: string, doc: LegalDocument): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "legal" });
  const alternates = pageAlternates(locale, `/${doc}`);
  const title = t(`${doc}.metaTitle`);
  const description = t(`${doc}.metaDescription`);

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

/** `<email>{address}</email>` in the copy becomes a mailto link to support */
const richValues = {
  address: SUPPORT_EMAIL,
  email: (chunks: React.ReactNode) => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-moya-red underline underline-offset-2 hover:text-moya-red-light">
      {chunks}
    </a>
  ),
};

/** Terms & Conditions or Privacy Policy: server-rendered from the `legal` messages (src/lib/legal.ts). */
export async function LegalPage({ locale, doc }: { locale: string; doc: LegalDocument }) {
  const t = await getTranslations({ locale, namespace: "legal" });
  const sections = LEGAL_SECTIONS[doc].map((id) => {
    const key = `${doc}.sections.${id}`;
    return { id, key, paragraphs: countItems(t.has, `${key}.body`), bullets: countItems(t.has, `${key}.list`) };
  });
  const Icon = ICONS[doc];

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-[#07070b] pt-28 pb-20 px-4 sm:px-6 transition-colors">
      <article className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-moya-red/10 text-moya-red border border-moya-red/20">
            <Icon className="w-3.5 h-3.5" />
            <span>{t("lastUpdated", { date: formatLastUpdated(locale) })}</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight">
            {t(`${doc}.title`)}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">{t(`${doc}.intro`)}</p>
        </header>

        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl space-y-8">
          {sections.map(({ id, key, paragraphs, bullets }) => (
            <section key={id} id={id} className="space-y-3 scroll-mt-28">
              <h2 className="font-display font-bold text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">
                {t(`${key}.heading`)}
              </h2>
              {Array.from({ length: paragraphs }, (_, i) => (
                <p key={i} className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t.rich(`${key}.body.${i}`, richValues)}
                </p>
              ))}
              {bullets > 0 && (
                <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed marker:text-moya-red">
                  {Array.from({ length: bullets }, (_, i) => (
                    <li key={i}>{t.rich(`${key}.list.${i}`, richValues)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
