import { describe, expect, it } from "vitest";

// Every Convex module's source, to check how it registers its mutations.
const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const RAW_BUILDER = /import\s*\{[^}]*\b(mutation|internalMutation)\b[^}]*\}\s*from\s*"[./]*_generated\/server"/;

describe("mutation builders", () => {
  it("every module registers mutations through lib/functions, so table triggers always run", () => {
    const offenders = Object.entries(sources)
      .filter(([path, source]) => path !== "/convex/lib/functions.ts" && RAW_BUILDER.test(source))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
