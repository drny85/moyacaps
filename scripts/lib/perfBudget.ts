/**
 * Pure helpers for the Lighthouse performance budget (ADR 0016 motion budget, ADR 0018).
 * No I/O here: scripts/perf-budget.ts runs Lighthouse and feeds the reports in.
 */

export interface Budget {
  /** Minimum Lighthouse performance score, 0–100 */
  minPerformance: number;
  /** Maximum Largest Contentful Paint, milliseconds */
  maxLcpMs: number;
}

export const DEFAULT_BUDGET: Budget = { minPerformance: 90, maxLcpMs: 2500 };

/** The numbers we keep from one Lighthouse run */
export interface RunMetrics {
  performance: number;
  lcpMs: number;
  fcpMs: number;
  tbtMs: number;
  cls: number;
  speedIndexMs: number;
}

export interface PageResult {
  path: string;
  runs: RunMetrics[];
  median: RunMetrics;
  pass: boolean;
  failures: string[];
}

/** Lighthouse JSON report, only the fields we read */
export interface LighthouseReport {
  categories: { performance: { score: number | null } };
  audits: Record<string, { numericValue?: number }>;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function metricsFromReport(report: LighthouseReport): RunMetrics {
  const audit = (id: string) => {
    const value = report.audits[id]?.numericValue;
    if (typeof value !== "number") throw new Error(`Lighthouse report is missing audit "${id}"`);
    return value;
  };
  const score = report.categories.performance.score;
  if (score === null) throw new Error("Lighthouse returned no performance score (page failed to load?)");
  return {
    performance: Math.round(score * 100),
    lcpMs: audit("largest-contentful-paint"),
    fcpMs: audit("first-contentful-paint"),
    tbtMs: audit("total-blocking-time"),
    cls: audit("cumulative-layout-shift"),
    speedIndexMs: audit("speed-index"),
  };
}

/** Per-metric median across runs (each metric independently, like Lighthouse CI) */
export function medianMetrics(runs: RunMetrics[]): RunMetrics {
  const pick = (key: keyof RunMetrics) => median(runs.map((run) => run[key]));
  return {
    performance: pick("performance"),
    lcpMs: pick("lcpMs"),
    fcpMs: pick("fcpMs"),
    tbtMs: pick("tbtMs"),
    cls: pick("cls"),
    speedIndexMs: pick("speedIndexMs"),
  };
}

export function evaluatePage(path: string, runs: RunMetrics[], budget: Budget): PageResult {
  const m = medianMetrics(runs);
  const failures: string[] = [];
  if (m.performance < budget.minPerformance) {
    failures.push(`performance ${m.performance} < ${budget.minPerformance}`);
  }
  if (m.lcpMs >= budget.maxLcpMs) {
    failures.push(`LCP ${formatMs(m.lcpMs)} >= ${formatMs(budget.maxLcpMs)}`);
  }
  return { path, runs, median: m, pass: failures.length === 0, failures };
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

/** Markdown table, ready to paste into a plan doc */
export function formatTable(results: PageResult[]): string {
  const rows = results.map(({ path, median: m, runs, pass }) =>
    [
      path,
      String(m.performance),
      formatMs(m.lcpMs),
      formatMs(m.fcpMs),
      formatMs(m.tbtMs),
      m.cls.toFixed(3),
      formatMs(m.speedIndexMs),
      runs.map((run) => run.performance).join(" / "),
      pass ? "pass" : "FAIL",
    ].join(" | ")
  );
  return [
    "Page | Perf | LCP | FCP | TBT | CLS | SI | Runs (perf) | Budget",
    "--- | --- | --- | --- | --- | --- | --- | --- | ---",
    ...rows,
  ]
    .map((row) => `| ${row} |`)
    .join("\n");
}

export interface PerfBudgetArgs {
  port: number;
  runs: number;
  build: boolean;
  /** Base URL to test instead of building and serving locally (e.g. a Vercel preview) */
  url: string | null;
  pages: string[] | null;
  /** Extra request headers for every page load (e.g. a Vercel protection cookie) */
  headers: Record<string, string>;
  /**
   * "simulate" (Lighthouse's default Lantern model, what PageSpeed Insights reports) or
   * "devtools" (really throttles the network and CPU and measures the page as it loads)
   */
  throttling: "simulate" | "devtools";
  budget: Budget;
}

export function parseArgs(argv: string[]): PerfBudgetArgs {
  const args: PerfBudgetArgs = {
    port: 3210,
    runs: 3,
    build: true,
    url: null,
    pages: null,
    headers: {},
    throttling: "simulate",
    budget: { ...DEFAULT_BUDGET },
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    const int = () => {
      const n = Number(value());
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number`);
      return n;
    };
    switch (flag) {
      case "--port": args.port = int(); break;
      case "--runs": args.runs = int(); break;
      case "--skip-build": args.build = false; break;
      case "--url": args.url = value().replace(/\/+$/, ""); args.build = false; break;
      case "--pages": args.pages = value().split(",").map((p) => p.trim()).filter(Boolean); break;
      case "--header": {
        const raw = value();
        const sep = raw.indexOf(":");
        if (sep <= 0) throw new Error(`--header needs "Name: value", got "${raw}"`);
        args.headers[raw.slice(0, sep).trim()] = raw.slice(sep + 1).trim();
        break;
      }
      case "--devtools": args.throttling = "devtools"; break;
      case "--min-performance": args.budget.minPerformance = int(); break;
      case "--max-lcp": args.budget.maxLcpMs = int(); break;
      default: throw new Error(`Unknown flag ${flag}`);
    }
  }
  return args;
}

/** First product page linked from the Shop HTML, so the budget follows the live catalog */
export function firstProductPath(shopHtml: string, locale = "en"): string | null {
  const match = shopHtml.match(new RegExp(`href="(/${locale}/products/[a-z0-9-]+)"`));
  return match ? match[1] : null;
}
