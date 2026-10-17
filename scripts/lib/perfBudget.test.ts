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
  it("judges performance on simulated runs and LCP on applied-throttling runs", () => {
    // Simulated LCP is slow (bundle-bound) but does not gate; applied LCP does
    const result = evaluatePage(
      "/en",
      { simulated: [run(94, 3000), run(95, 2900), run(93, 3100)], applied: [run(96, 1900), run(97, 1800), run(90, 2100)] },
      DEFAULT_BUDGET
    );
    expect(result.simulatedMedian.performance).toBe(94);
    expect(result.appliedMedian.lcpMs).toBe(1900);
    expect(result.pass).toBe(true);
  });

  it("passes on the median even when one run is an outlier", () => {
    const result = evaluatePage(
      "/en",
      { simulated: [run(93, 3000), run(70, 6000), run(92, 3000)], applied: [run(95, 2000), run(60, 6000), run(95, 2200)] },
      DEFAULT_BUDGET
    );
    expect(result.pass).toBe(true);
  });

  it("names each broken limit with the method it was measured by", () => {
    const result = evaluatePage("/en", { simulated: [run(80, 2000)], applied: [run(99, 3000)] }, DEFAULT_BUDGET);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(["performance 80 < 90 (simulated)", "LCP 3.00 s >= 2.50 s (applied throttling)"]);
  });

  it("ignores the applied runs' score and the simulated runs' LCP", () => {
    const result = evaluatePage("/en", { simulated: [run(95, 9000)], applied: [run(10, 1500)] }, DEFAULT_BUDGET);
    expect(result.pass).toBe(true);
  });

  it("treats LCP equal to the limit as a failure (budget is LCP < 2.5 s)", () => {
    expect(evaluatePage("/en", { simulated: [run(95, 1000)], applied: [run(95, 2500)] }, DEFAULT_BUDGET).pass).toBe(false);
  });
});

describe("formatTable", () => {
  it("renders one markdown row per page, gated columns first", () => {
    const table = formatTable([
      evaluatePage("/en", { simulated: [run(91, 2900)], applied: [run(97, 1900)] }, DEFAULT_BUDGET),
    ]);
    expect(table.split("\n")).toHaveLength(3);
    expect(table).toContain("| /en | 91 | 1.90 s | 2.90 s | 900 ms | 40 ms | 0.000 | 91 | 1.90 s | pass |");
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
