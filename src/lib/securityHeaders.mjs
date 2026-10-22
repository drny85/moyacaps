/**
 * Response security headers for every route (next.config.mjs). Plain ESM so next.config.mjs
 * can import it; covered by securityHeaders.test.ts.
 *
 * The Content-Security-Policy ships Report-Only first (security review M3): browsers report
 * what it would block, to `/api/csp-report` (logged as `[CSP]` in Vercel), without blocking
 * it. Once a release shows no violations on the storefront, checkout, try-on, sign-in and
 * admin, set `CSP_ENFORCE=1` in Vercel and redeploy: the same policy is then enforced, and
 * still reported. Next's inline bootstrap scripts need 'unsafe-inline' until the app moves to
 * per-request nonces.
 */

/** Where browsers send CSP violation reports (src/app/api/csp-report/route.ts). */
export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * The app's own Convex deployment, from NEXT_PUBLIC_CONVEX_URL (security review L5): the
 * browser and the image optimizer talk to this deployment only, not to every Convex customer's.
 * A missing or non-cloud URL (the local backend) falls back to the wildcards, so a build
 * without the variable still works.
 *
 * @param {string | undefined} convexUrl
 */
export function convexOrigins(convexUrl) {
  const match = /^https:\/\/([a-z0-9-]+)\.convex\.cloud\/?$/.exec(convexUrl ?? "");
  if (!match) {
    return { cloud: "https://*.convex.cloud", ws: "wss://*.convex.cloud", site: "https://*.convex.site", hostname: null };
  }
  const name = match[1];
  return {
    cloud: `https://${name}.convex.cloud`,
    ws: `wss://${name}.convex.cloud`,
    site: `https://${name}.convex.site`,
    hostname: `${name}.convex.cloud`,
  };
}

/**
 * next.config `images.remotePatterns`: Clerk avatars and this deployment's stored files only,
 * so the image optimizer cannot be pointed at another deployment's storage.
 *
 * @param {string | undefined} convexUrl
 */
export function imageRemotePatterns(convexUrl) {
  const { hostname } = convexOrigins(convexUrl);
  return [
    { protocol: "https", hostname: "img.clerk.com" },
    { protocol: "https", hostname: "images.clerk.dev" },
    { protocol: "https", hostname: hostname ?? "*.convex.cloud", pathname: "/api/storage/**" },
  ];
}

/** Third-party origins the app talks to, by directive. */
const SOURCES = {
  // Clerk (prod Frontend API on our subdomain, dev instances, Turnstile bot check) and Stripe.js
  script: [
    "https://clerk.goodluckcaps.com",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
    "https://js.stripe.com",
    // MediaPipe face detection wasm loader for try-on (src/lib/tryOn/detector.ts)
    "https://cdn.jsdelivr.net",
  ],
  connect: [
    "https://clerk.goodluckcaps.com",
    "https://*.clerk.accounts.dev",
    "https://api.stripe.com",
    "https://cdn.jsdelivr.net",
  ],
  img: ["https://img.clerk.com", "https://images.clerk.dev"],
  frame: ["https://challenges.cloudflare.com", "https://js.stripe.com", "https://hooks.stripe.com"],
};

/** @param {{ dev: boolean, convexUrl?: string }} options */
export function contentSecurityPolicy({ dev, convexUrl }) {
  const convex = convexOrigins(convexUrl);
  const directives = {
    "default-src": ["'self'"],
    // Dev's React Refresh evaluates code; MediaPipe compiles wasm in every environment.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : []), ...SOURCES.script],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...SOURCES.img, convex.cloud],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      convex.cloud,
      convex.ws,
      convex.site,
      ...SOURCES.connect,
      ...(dev ? ["ws:", "http://127.0.0.1:3210", "ws://127.0.0.1:3210"] : []),
    ],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", ...SOURCES.frame],
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'", "https://checkout.stripe.com"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    // `report-uri` for browsers without the Reporting API; `report-to` names Reporting-Endpoints.
    "report-uri": [CSP_REPORT_PATH],
    "report-to": ["csp"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** @param {{ dev: boolean, convexUrl?: string, enforceCsp?: boolean }} options */
export function securityHeaders({ dev, convexUrl, enforceCsp = false }) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Try-on opens the front camera (CameraSheet); third-party frames still get none.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Reporting-Endpoints", value: `csp="${CSP_REPORT_PATH}"` },
    {
      key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy({ dev, convexUrl }),
    },
  ];
}
