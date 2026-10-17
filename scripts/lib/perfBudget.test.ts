import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDGET,
  evaluatePage,
  firstProductPath,
  formatTable,
  median,
  metricsFromReport,
  parseArgs,
  type LighthouseReport,
  type RunMetrics,
} from "./perfBudget";

const run = (performance: number, lcpMs: number): RunMetrics => ({
  performance,
  lcpMs,
  fcpMs: 900,
  tbtMs: 40,
  cls: 0,
  speedIndexMs: 1800,
});

describe("median", () => {
  it("takes the middle of an odd list and the mean of the middle pair of an even one", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not reorder the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it("rejects an empty list", () => {
    expect(() => median([])).toThrow();
  });
});

describe("metricsFromReport", () => {
  const report: LighthouseReport = {
    categories: { performance: { score: 0.914 } },
    audits: {
      "largest-contentful-paint": { numericValue: 2100 },
      "first-contentful-paint": { numericValue: 950 },
      "total-blocking-time": { numericValue: 60 },
      "cumulative-layout-shift": { numericValue: 0.01 },
      "speed-index": { numericValue: 2000 },
    },
  };

  it("scales the score to 0–100 and reads the timing audits", () => {
    expect(metricsFromReport(report)).toEqual({
      performance: 91,
      lcpMs: 2100,
      fcpMs: 950,
      tbtMs: 60,
      cls: 0.01,
      speedIndexMs: 2000,
    });
  });

  it("fails loudly when the page produced no score", () => {
    expect(() =>
      metricsFromReport({ ...report, categories: { performance: { score: null } } })
    ).toThrow(/no performance score/);
  });

  it("fails loudly when an audit is missing", () => {
    expect(() => metricsFromReport({ ...report, audits: {} })).toThrow(/largest-contentful-paint/);
  });
});

describe("evaluatePage", () => {
  it("passes on the median even when one run is an outlier", () => {
    const result = evaluatePage("/en", [run(93, 2000), run(70, 6000), run(92, 2200)], DEFAULT_BUDGET);
    expect(result.median.performance).toBe(92);
    expect(result.median.lcpMs).toBe(2200);
    expect(result.pass).toBe(true);
  });

  it("names each broken limit", () => {
    const result = evaluatePage("/en", [run(80, 3000)], DEFAULT_BUDGET);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(["performance 80 < 90", "LCP 3.00 s >= 2.50 s"]);
  });

  it("treats LCP equal to the limit as a failure (budget is LCP < 2.5 s)", () => {
    expect(evaluatePage("/en", [run(95, 2500)], DEFAULT_BUDGET).pass).toBe(false);
  });
});

describe("formatTable", () => {
  it("renders one markdown row per page", () => {
    const table = formatTable([evaluatePage("/en", [run(91, 2100)], DEFAULT_BUDGET)]);
    expect(table.split("\n")).toHaveLength(3);
    expect(table).toContain("| /en | 91 | 2.10 s | 900 ms | 40 ms | 0.000 | 1.80 s | 91 | pass |");
  });
});

describe("parseArgs", () => {
  it("defaults to a local build, 3 runs and the ADR 0016 budget", () => {
    expect(parseArgs([])).toEqual({
      port: 3210,
      runs: 3,
      build: true,
      url: null,
      pages: null,
      headers: {},
      throttling: "simulate",
      budget: { minPerformance: 90, maxLcpMs: 2500 },
    });
  });

  it("skips the build when testing a deployed URL", () => {
    const args = parseArgs(["--url", "https://preview.example.com/", "--runs", "5"]);
    expect(args.url).toBe("https://preview.example.com");
    expect(args.build).toBe(false);
    expect(args.runs).toBe(5);
  });

  it("splits a page list", () => {
    expect(parseArgs(["--pages", "/en, /en/products"]).pages).toEqual(["/en", "/en/products"]);
  });

  it("collects request headers, keeping colons in the value", () => {
    expect(parseArgs(["--header", "Cookie: _vercel_jwt=a:b", "--header", "X-Test:1"]).headers).toEqual({
      Cookie: "_vercel_jwt=a:b",
      "X-Test": "1",
    });
    expect(() => parseArgs(["--header", "nocolon"])).toThrow(/Name: value/);
  });

  it("switches to applied DevTools throttling", () => {
    expect(parseArgs(["--devtools"]).throttling).toBe("devtools");
  });

  it("rejects unknown flags and bad numbers", () => {
    expect(() => parseArgs(["--fast"])).toThrow(/Unknown flag/);
    expect(() => parseArgs(["--runs", "zero"])).toThrow(/positive number/);
    expect(() => parseArgs(["--port"])).toThrow(/needs a value/);
  });
});

describe("firstProductPath", () => {
  it("finds the first product link for the locale", () => {
    const html = `<a href="/en/products?category=caps">Caps</a><a href="/en/products/0880-black">Cap</a>`;
    expect(firstProductPath(html)).toBe("/en/products/0880-black");
  });

  it("returns null when the Shop lists nothing", () => {
    expect(firstProductPath("<main></main>")).toBeNull();
  });
});
