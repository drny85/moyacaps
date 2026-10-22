import createNextIntlPlugin from "next-intl/plugin";
import { imageRemotePatterns, securityHeaders } from "./src/lib/securityHeaders.mjs";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    // Compile ICU messages at build time so the client ships no message parser (ADR 0018)
    messages: { path: "./src/messages", format: "json", locales: "infer", precompile: true },
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Photo Autofill sends up to four downscaled photos (≤ 1 MB each) to one server action
    // (ADR 0027). This limit applies to every server action; Vercel caps bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // `ANALYZE_SOURCEMAPS=1 bun run build` emits browser source maps to attribute chunk bytes to modules
  productionBrowserSourceMaps: process.env.ANALYZE_SOURCEMAPS === "1",
  images: {
    formats: ["image/avif", "image/webp"],
    // Clerk avatars and this app's own Convex storage only (L5); see securityHeaders.mjs.
    remotePatterns: imageRemotePatterns(process.env.NEXT_PUBLIC_CONVEX_URL),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
          // Report-Only until CSP_ENFORCE=1 (security review M3)
          enforceCsp: process.env.CSP_ENFORCE === "1",
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
