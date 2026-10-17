/**
 * Pure helpers for the Lighthouse performance budget (ADR 0016 motion budget, ADR 0018,
 * ADR 0019). No I/O here: scripts/perf-budget.ts runs Lighthouse and feeds the reports in.
 *
 * Each page is measured two ways, and each limit is judged on its own (ADR 0019):
 * - performance score: Lighthouse's default simulated throttling (the Lantern model that
 *   PageSpeed Insights reports);
 * - LCP: applied DevTools throttling (slow 4G + 4x CPU actually applied), which measures
 *   when the largest element paints. Simulated LCP counts all first-load JS requested
 *   before the observed LCP, so it tracks bundle size rather than the paint.
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

export type Throttling = "simulate" | "devtools";

export interface PageResult {
  path: string;
  /** Simulated-throttling runs: judge the performance score */
  simulated: RunMetrics[];
  /** Applied-throttling runs: judge LCP */
  applied: RunMetrics[];
  simulatedMedian: RunMetrics;
  appliedMedian: RunMetrics;
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

export function evaluatePage(
  path: string,
  { simulated, applied }: { simulated: RunMetrics[]; applied: RunMetrics[] },
  budget: Budget
): PageResult {
  const sim = medianMetrics(simulated);
  const app = medianMetrics(applied);
  const failures: string[] = [];
  if (sim.performance < budget.minPerformance) {
    failures.push(`performance ${sim.performance} < ${budget.minPerformance} (simulated)`);
  }
  if (app.lcpMs >= budget.maxLcpMs) {
    failures.push(`LCP ${formatMs(app.lcpMs)} >= ${formatMs(budget.maxLcpMs)} (applied throttling)`);
  }
  return {
    path,
    simulated,
    applied,
    simulatedMedian: sim,
    appliedMedian: app,
    pass: failures.length === 0,
    failures,
  };
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

/**
 * Markdown table, ready to paste into a plan doc. The two gated columns come first:
 * performance (simulated) and LCP (applied); simulated LCP is shown for reference.
 */
export function formatTable(results: PageResult[]): string {
  const rows = results.map(({ path, simulatedMedian: sim, appliedMedian: app, simulated, applied, pass }) =>
    [
      path,
      String(sim.performance),
      formatMs(app.lcpMs),
      formatMs(sim.lcpMs),
      formatMs(app.fcpMs),
      formatMs(sim.tbtMs),
      sim.cls.toFixed(3),
      simulated.map((run) => run.performance).join(" / "),
      applied.map((run) => formatMs(run.lcpMs)).join(" / "),
      pass ? "pass" : "FAIL",
    ].join(" | ")
  );
  return [
    "Page | Perf (sim) | LCP (applied) | LCP (sim, ref.) | FCP (applied) | TBT (sim) | CLS | Runs perf (sim) | Runs LCP (applied) | Budget",
    "--- | --- | --- | --- | --- | --- | --- | --- | --- | ---",
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
