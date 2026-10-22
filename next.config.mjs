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
    // Photo Autofill sends up to four downscaled photos (≤ 1 MB each) to one server action
    // (ADR 0027). This limit applies to every server action; Vercel caps bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
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
            // Try-on opens the front camera (CameraSheet); third-party frames still get none.
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
