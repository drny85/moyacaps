/**
 * The client IP of the current request, for the Checkout Pass (ADR 0029). Vercel sets
 * `x-real-ip` and overwrites `x-forwarded-for` with the connecting client, so neither can be
 * spoofed there. Self-hosted behind another proxy, both are only as trustworthy as that proxy.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}
