/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

describe("revalidateStorefront", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs to the site's revalidate route with the shared secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    vi.stubEnv("REVALIDATE_SECRET", "s3cret");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await convexTest(schema, modules).action(internal.settings.revalidate.revalidateStorefront, {});

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/api/revalidate", {
      method: "POST",
      headers: { "x-revalidate-secret": "s3cret" },
    });
  });

  it("does nothing without the site URL or the secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    vi.stubEnv("REVALIDATE_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(convexTest(schema, modules).action(internal.settings.revalidate.revalidateStorefront, {})).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows fetch failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    vi.stubEnv("REVALIDATE_SECRET", "s3cret");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(convexTest(schema, modules).action(internal.settings.revalidate.revalidateStorefront, {})).resolves.toBeNull();
  });
});
