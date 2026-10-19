import { describe, expect, it } from "vitest";
import type { CapVariant } from "@/data/caps";
import { selectCatalog, shouldSwallowSeedError } from "./selectCatalog";

const cap = (id: string) => ({ id }) as CapVariant;
const seed = [cap("seed-a")];

describe("selectCatalog", () => {
  it("returns the seed while the live query is loading", () => {
    expect(selectCatalog(seed, undefined)).toEqual({ caps: seed, isLive: false });
  });

  it("keeps the seed when the live list is empty", () => {
    expect(selectCatalog(seed, [])).toEqual({ caps: seed, isLive: false });
  });

  it("returns the live list once it has rows", () => {
    const live = [cap("live-a"), cap("live-b")];
    expect(selectCatalog(seed, live)).toEqual({ caps: live, isLive: true });
  });
});

describe("shouldSwallowSeedError", () => {
  it("swallows only during the production build", () => {
    expect(shouldSwallowSeedError("phase-production-build")).toBe(true);
  });

  it("rethrows at runtime so ISR keeps the last good page", () => {
    expect(shouldSwallowSeedError("phase-production-server")).toBe(false);
    expect(shouldSwallowSeedError(undefined)).toBe(false);
  });
});
