import { describe, expect, it } from "vitest";
import { parseCspReports, redactUrl } from "./cspReport";

describe("redactUrl", () => {
  it("drops the query and fragment, which can carry tokens", () => {
    expect(redactUrl("https://goodluckcaps.com/en/checkout/success?session_id=cs_live_1#x")).toBe(
      "https://goodluckcaps.com/en/checkout/success"
    );
  });

  it("passes keywords through and ignores non-strings", () => {
    expect(redactUrl("inline")).toBe("inline");
    expect(redactUrl("eval")).toBe("eval");
    expect(redactUrl(undefined)).toBe("");
    expect(redactUrl(42)).toBe("");
  });
});

describe("parseCspReports", () => {
  it("reads a report-uri body", () => {
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://goodluckcaps.com/en?ref=x",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?t=1",
        "source-file": "https://goodluckcaps.com/_next/a.js",
      },
    });
    expect(parseCspReports(body)).toEqual([
      {
        directive: "script-src-elem",
        blocked: "https://evil.example/x.js",
        page: "https://goodluckcaps.com/en",
        source: "https://goodluckcaps.com/_next/a.js",
      },
    ]);
  });

  it("reads a report-to batch, keeping only CSP violations", () => {
    const body = JSON.stringify([
      {
        type: "csp-violation",
        body: { documentURL: "https://goodluckcaps.com/es", effectiveDirective: "img-src", blockedURL: "https://x.example/a.png" },
      },
      { type: "deprecation", body: { id: "x" } },
    ]);
    expect(parseCspReports(body)).toEqual([
      { directive: "img-src", blocked: "https://x.example/a.png", page: "https://goodluckcaps.com/es" },
    ]);
  });

  it("caps a batch at 10 reports and long fields at 200 characters", () => {
    const report = { type: "csp-violation", body: { effectiveDirective: "x".repeat(500), blockedURL: "inline" } };
    const parsed = parseCspReports(JSON.stringify(Array(50).fill(report)));
    expect(parsed).toHaveLength(10);
    expect(parsed[0].directive).toHaveLength(200);
  });

  it("returns nothing for bodies that are not CSP reports", () => {
    expect(parseCspReports("not json")).toEqual([]);
    expect(parseCspReports("{}")).toEqual([]);
    expect(parseCspReports("null")).toEqual([]);
    expect(parseCspReports(JSON.stringify([{ type: "csp-violation" }]))).toEqual([]);
  });
});
