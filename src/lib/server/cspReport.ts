/**
 * CSP violation reports (security review M3), from either format browsers send:
 * `application/csp-report` (`{ "csp-report": {...} }`, from `report-uri`) or
 * `application/reports+json` (an array of `{ type: "csp-violation", body: {...} }`, from
 * `report-to`). Anyone can POST here, so input is bounded and URLs lose their query and
 * fragment: a page URL can carry a token (unsubscribe links, checkout session ids).
 */

/** Largest body read; a real report is well under 2 KB. */
export const MAX_CSP_REPORT_BYTES = 16_384;
/** Reports logged per request; a reports+json batch can hold several. */
const MAX_REPORTS = 10;
const MAX_FIELD_LENGTH = 200;

export type CspViolation = {
  directive: string;
  blocked: string;
  page: string;
  source?: string;
};

/** A URL without its query and fragment; keywords such as "inline" or "eval" pass through. */
export function redactUrl(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD_LENGTH);
  } catch {
    return value.split(/[?#]/)[0].slice(0, MAX_FIELD_LENGTH);
  }
}

function field(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

function fromLegacy(report: Record<string, unknown>): CspViolation {
  return {
    directive: field(report["effective-directive"] ?? report["violated-directive"]),
    blocked: redactUrl(report["blocked-uri"]),
    page: redactUrl(report["document-uri"]),
    ...(report["source-file"] ? { source: redactUrl(report["source-file"]) } : {}),
  };
}

function fromReportingApi(body: Record<string, unknown>): CspViolation {
  return {
    directive: field(body.effectiveDirective),
    blocked: redactUrl(body.blockedURL),
    page: redactUrl(body.documentURL),
    ...(body.sourceFile ? { source: redactUrl(body.sourceFile) } : {}),
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The violations in a report body, or [] when it is not a CSP report. */
export function parseCspReports(raw: string): CspViolation[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (isObject(data) && isObject(data["csp-report"])) return [fromLegacy(data["csp-report"])];
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is Record<string, unknown> => isObject(r) && r.type === "csp-violation" && isObject(r.body))
    .slice(0, MAX_REPORTS)
    .map((r) => fromReportingApi(r.body as Record<string, unknown>));
}
