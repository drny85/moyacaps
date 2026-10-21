import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { runPhotoAutofill, type AutofillDeps } from "./photoAutofill";
import type { AutofillProposal } from "../admin/photoAutofill/schema";
import { teeRow } from "../admin/photoAutofill/testRows";

vi.mock("server-only", () => ({}));

const proposal: AutofillProposal = {
  recognized: "cap",
  note: "",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#eeeeee",
  nameEn: "Night Snap",
  nameEs: "Snap Nocturna",
  slug: "night-snap",
  descriptionEn: "A black Cap.",
  descriptionEs: "Una gorra negra.",
  colorways: [],
  fabricEn: "",
  fabricEs: "",
  fitEn: "",
  fitEs: "",
};

function mockModel(text: string | (() => never) = JSON.stringify(proposal)) {
  const doGenerate = vi.fn(async () => {
    if (typeof text === "function") text();
    return {
      content: [{ type: "text" as const, text: text as string }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    };
  });
  return { model: new MockLanguageModelV4({ doGenerate }), doGenerate };
}

function deps(overrides: Partial<AutofillDeps> = {}): AutofillDeps {
  return { isAdmin: async () => true, loadRows: async () => [teeRow()], model: mockModel().model, ...overrides };
}

const photo = (bytes = 1000) => ({ data: new Uint8Array(bytes), mediaType: "image/jpeg" });

describe("runPhotoAutofill", () => {
  it("refuses a non-admin before loading the catalog or calling the model", async () => {
    const { model, doGenerate } = mockModel();
    const loadRows = vi.fn(async () => []);
    expect(await runPhotoAutofill(deps({ isAdmin: async () => false, model, loadRows }), [photo()], "en")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(loadRows).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("rejects zero photos, five photos and an oversized photo", async () => {
    expect(await runPhotoAutofill(deps(), [], "en")).toEqual({ ok: false, error: "bad_photos" });
    expect(await runPhotoAutofill(deps(), Array.from({ length: 5 }, () => photo()), "en")).toEqual({ ok: false, error: "bad_photos" });
    expect(await runPhotoAutofill(deps(), [photo(2 * 1024 * 1024)], "en")).toEqual({ ok: false, error: "bad_photos" });
  });

  it("returns the proposal and the catalog context the prompt used", async () => {
    const result = await runPhotoAutofill(deps(), [photo()], "en");
    expect(result).toMatchObject({ ok: true, proposal, context: { takenSlugs: ["skull-tee"] } });
  });

  it("sends each photo as an image file part with the catalog in the system prompt", async () => {
    const { model, doGenerate } = mockModel();
    await runPhotoAutofill(deps({ model }), [photo(), photo()], "es");
    const call = doGenerate.mock.calls[0] as unknown as [{ prompt: { role: string; content: unknown }[] }];
    const [system, user] = call[0].prompt;
    expect(JSON.stringify(system.content)).toContain("vintage-black");
    expect(JSON.stringify(system.content)).toContain("Spanish");
    const files = (user.content as { type: string; mediaType?: string }[]).filter((p) => p.type === "file");
    expect(files).toHaveLength(2);
    expect(files[0].mediaType).toBe("image/jpeg");
  });

  it("reports a model error as model_failed", async () => {
    const { model } = mockModel(() => {
      throw new Error("gateway down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runPhotoAutofill(deps({ model }), [photo()], "en")).toEqual({ ok: false, error: "model_failed" });
  });

  it("reports unparseable model output as model_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runPhotoAutofill(deps({ model: mockModel("not json").model }), [photo()], "en")).toEqual({
      ok: false,
      error: "model_failed",
    });
  });
});
