import type { MetadataRoute } from "next";
import { CAP_VARIANTS } from "@/data/caps";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");
  const locales = ["en", "es"];
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    // Root URL redirect/landing
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${siteUrl}/en`,
          es: `${siteUrl}/es`,
        },
      },
    },
  ];

  // Localized routes
  for (const locale of locales) {
    // 1. Localized Home
    entries.push({
      url: `${siteUrl}/${locale}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${siteUrl}/en`,
          es: `${siteUrl}/es`,
        },
      },
    });

    // 2. Order Tracking
    entries.push({
      url: `${siteUrl}/${locale}/track`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
      alternates: {
        languages: {
          en: `${siteUrl}/en/track`,
          es: `${siteUrl}/es/track`,
        },
      },
    });

    // 3. Cap detail pages
    for (const cap of CAP_VARIANTS) {
      entries.push({
        url: `${siteUrl}/${locale}/caps/${cap.id}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: {
            en: `${siteUrl}/en/caps/${cap.id}`,
            es: `${siteUrl}/es/caps/${cap.id}`,
          },
        },
      });
    }
  }

  return entries;
}
