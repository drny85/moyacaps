import createNextIntlPlugin from "next-intl/plugin";

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
    // Photo Autofill sends up to four downscaled photos to one server action (ADR 0027)
    serverActions: { bodySizeLimit: "4mb" },
  },
  // `ANALYZE_SOURCEMAPS=1 bun run build` emits browser source maps to attribute chunk bytes to modules
  productionBrowserSourceMaps: process.env.ANALYZE_SOURCEMAPS === "1",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "*.convex.site",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
