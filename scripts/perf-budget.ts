/**
 * Lighthouse mobile performance budget for the storefront (ADR 0016 §8, ADR 0018).
 *
 *   bun run perf-budget                      build, serve on :3210, 3 runs per page
 *   bun run perf-budget --skip-build         reuse the current .next build
 *   bun run perf-budget --url https://…      test a deployed URL (e.g. a Vercel preview)
 *   bun run perf-budget --runs 5 --pages /en,/en/products
 *
 * Fails (exit 1) when the median performance score is below 90 or the median LCP is
 * 2.5 s or more on any page. Lighthouse uses its default mobile emulation (Moto G
 * Power, simulated slow 4G, 4× CPU slowdown). Local numbers swing with machine load:
 * close other heavy apps, and trust a preview deployment over a busy laptop.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  evaluatePage,
  firstProductPath,
  formatTable,
  metricsFromReport,
  parseArgs,
  type LighthouseReport,
  type PageResult,
  type RunMetrics,
} from "./lib/perfBudget";

const ROOT = path.resolve(import.meta.dir, "..");
const LIGHTHOUSE = path.join(ROOT, "node_modules", ".bin", "lighthouse");

function run(cmd: string, args: string[], opts: { quiet?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: opts.quiet ? "ignore" : "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))
    );
  });
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not come up within ${timeoutMs / 1000}s`);
}

async function lighthouseRun(url: string, outDir: string, index: number): Promise<RunMetrics> {
  const out = path.join(outDir, `${index}.json`);
  await run(
    LIGHTHOUSE,
    [
      url,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${out}`,
      "--quiet",
      "--chrome-flags=--headless=new",
    ],
    { quiet: true }
  );
  const report = JSON.parse(await fs.readFile(out, "utf8")) as LighthouseReport;
  return metricsFromReport(report);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let server: ChildProcess | null = null;
  const base = args.url ?? `http://localhost:${args.port}`;

  try {
    if (args.build) await run("bun", ["run", "build"]);
    if (!args.url) {
      server = spawn("bunx", ["next", "start", "-p", String(args.port)], { cwd: ROOT, stdio: "ignore" });
      await waitForServer(`${base}/en`);
    }

    let pages = args.pages;
    if (!pages) {
      const shop = await (await fetch(`${base}/en/products`)).text();
      const product = firstProductPath(shop);
      if (!product) throw new Error("No product link found on /en/products; pass --pages");
      pages = ["/en", "/en/products", product];
    }

    // Warm server caches (rendering, image optimizer) so run 1 is not a cold outlier
    for (const page of pages) await fetch(`${base}${page}`);

    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "perf-budget-"));
    const results: PageResult[] = [];
    for (const page of pages) {
      const runs: RunMetrics[] = [];
      for (let i = 0; i < args.runs; i++) {
        const metrics = await lighthouseRun(`${base}${page}`, outDir, results.length * 100 + i);
        runs.push(metrics);
        console.log(`  ${page} run ${i + 1}/${args.runs}: perf ${metrics.performance}, LCP ${Math.round(metrics.lcpMs)} ms`);
      }
      results.push(evaluatePage(page, runs, args.budget));
    }

    console.log(`\nLighthouse mobile, median of ${args.runs} — ${base}\n`);
    console.log(formatTable(results));
    console.log(`\nReports: ${outDir}`);

    const failed = results.filter((r) => !r.pass);
    if (failed.length) {
      console.error(`\nBudget failed:\n${failed.map((r) => `  ${r.path}: ${r.failures.join(", ")}`).join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(`\nBudget met (performance >= ${args.budget.minPerformance}, LCP < ${args.budget.maxLcpMs} ms).`);
    }
  } finally {
    server?.kill();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
