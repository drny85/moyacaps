/**
 * Response security headers for every route (next.config.mjs). Plain ESM so next.config.mjs
 * can import it; covered by securityHeaders.test.ts.
 *
 * The Content-Security-Policy ships Report-Only first (security review M3): browsers log what
 * it would block without blocking it. Once a release shows no violations in the console on
 * the storefront, checkout, try-on, sign-in and admin, switch the key to
 * `Content-Security-Policy`. Next's inline bootstrap scripts need 'unsafe-inline' until the
 * app moves to per-request nonces.
 */

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
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    "https://*.convex.site",
    "https://clerk.goodluckcaps.com",
    "https://*.clerk.accounts.dev",
    "https://api.stripe.com",
    "https://cdn.jsdelivr.net",
  ],
  img: ["https://img.clerk.com", "https://images.clerk.dev", "https://images.unsplash.com", "https://*.convex.cloud", "https://*.convex.site"],
  frame: ["https://challenges.cloudflare.com", "https://js.stripe.com", "https://hooks.stripe.com"],
};

/** @param {{ dev: boolean }} options */
export function contentSecurityPolicy({ dev }) {
  const directives = {
    "default-src": ["'self'"],
    // Dev's React Refresh evaluates code; MediaPipe compiles wasm in every environment.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : []), ...SOURCES.script],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...SOURCES.img],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...SOURCES.connect, ...(dev ? ["ws:", "http://127.0.0.1:3210", "ws://127.0.0.1:3210"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", ...SOURCES.frame],
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'", "https://checkout.stripe.com"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** @param {{ dev: boolean }} options */
export function securityHeaders({ dev }) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Try-on opens the front camera (CameraSheet); third-party frames still get none.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy({ dev }) },
  ];
}
