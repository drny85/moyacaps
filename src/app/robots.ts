import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/caps", "/caps/*", "/track", "/track/*"],
        disallow: [
          "/admin",
          "/admin/*",
          "/*/admin",
          "/*/admin/*",
          "/checkout",
          "/checkout/*",
          "/*/checkout",
          "/*/checkout/*",
          "/account",
          "/account/*",
          "/*/account",
          "/*/account/*",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
