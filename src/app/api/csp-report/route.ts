import { MAX_CSP_REPORT_BYTES, parseCspReports } from "@/lib/server/cspReport";

/**
 * Browsers POST CSP violations here (src/lib/securityHeaders.mjs). Each one is logged as
 * `[CSP]` in Vercel's runtime logs, which is where to look before setting CSP_ENFORCE=1.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CSP_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > MAX_CSP_REPORT_BYTES) return new Response(null, { status: 413 });
  for (const violation of parseCspReports(raw)) {
    console.warn("[CSP]", JSON.stringify(violation));
  }
  return new Response(null, { status: 204 });
}
