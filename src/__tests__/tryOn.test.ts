import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import { initialTryOnCap, tryOnCaps } from "../lib/tryOn/catalog";
import { MEDIAPIPE_VERSION, faceFromDetections } from "../lib/tryOn/detector";
import {
  CAP_ASPECT,
  CAP_CONTENT,
  DEFAULT_ANCHOR,
  FIT,
  LIMITS,
  NO_ADJUST,
  anchorFromFace,
  applyDrag,
  clampAdjust,
  applyPinch,
  pinchDelta,
  placeCap,
  type FaceKeypoints,
} from "../lib/tryOn/fit";
import { PHOTO_MAX, cardFileName, cardLayout, outputSide, squareCrop } from "../lib/tryOn/photo";

const NOW = Date.UTC(2026, 9, 17);

const cap = (id: string, over: Partial<CapVariant> = {}): CapVariant => ({
  id,
  nameEn: id,
  nameEs: id,
  silhouette: "snapback",
  primaryHex: "#000",
  secondaryHex: "#fff",
  image: `/caps/${id}.png`,
  catalogShot: `/catalog/caps/${id}.webp`,
  stock: 3,
  priceUsd: 120,
  ...over,
});

const overlayFor = ({ id }: CapVariant) => (id === "no-angles" ? null : `/catalog/caps/${id}/front.webp`);

describe("tryOnCaps", () => {
  it("offers visible caps with an overlay, never tees, purchasable first", () => {
    const list = tryOnCaps(
      [
        cap("sold", { stock: 0 }),
        cap("a"),
        cap("tee", { silhouette: "tee", category: "apparel" }),
        cap("hidden", { isAvailable: false }),
        cap("no-angles"),
        cap("b"),
      ],
      NOW,
      overlayFor
    );
    expect(list.map((c) => c.product.id)).toEqual(["a", "b", "sold"]);
    expect(list[2].purchasable).toBe(false);
    expect(list[0]).toMatchObject({ overlay: "/catalog/caps/a/front.webp", thumb: "/catalog/caps/a.webp" });
  });

  it("marks unreleased drops as not purchasable", () => {
    const [c] = tryOnCaps([cap("drop", { isDrop: true, dropStatus: "scheduled", dropDate: NOW + 1 })], NOW, overlayFor);
    expect(c.purchasable).toBe(false);
  });
});

describe("initialTryOnCap", () => {
  const list = tryOnCaps([cap("a"), cap("b"), cap("sold", { stock: 0 })], NOW, overlayFor);
  it("starts on the requested cap, else the first purchasable", () => {
    expect(initialTryOnCap(list, "b")?.product.id).toBe("b");
    expect(initialTryOnCap(list, "sold")?.product.id).toBe("sold");
    expect(initialTryOnCap(list, "missing")?.product.id).toBe("a");
    expect(initialTryOnCap([], "a")).toBeNull();
  });
});

/** An upright face centred at x = 0.5 */
const face = (over: Partial<FaceKeypoints> = {}): FaceKeypoints => ({
  eyes: [
    { x: 0.42, y: 0.5 },
    { x: 0.58, y: 0.5 },
  ],
  mouth: { x: 0.5, y: 0.62 },
  ears: [
    { x: 0.35, y: 0.53 },
    { x: 0.65, y: 0.53 },
  ],
  ...over,
});

describe("anchorFromFace", () => {
  it("centres an upright cap above the eyes, sized from the ear span", () => {
    const a = anchorFromFace(face());
    expect(a.x).toBeCloseTo(0.5);
    expect(a.rotation).toBeCloseTo(0);
    expect(a.width).toBeCloseTo(0.3 * FIT.widthPerEarSpan);
    // Lower edge of the cap sits brimAboveEyes eye-to-mouth lengths above the eyes
    const lowerEdge = a.y + (a.width * CAP_ASPECT) / 2;
    expect(lowerEdge).toBeCloseTo(0.5 - 0.12 * FIT.brimAboveEyes);
  });

  it("follows the head's roll and moves the cap along the tilted up direction", () => {
    const tilted = anchorFromFace(
      face({
        eyes: [
          { x: 0.42, y: 0.48 },
          { x: 0.58, y: 0.52 },
        ],
      })
    );
    expect(tilted.rotation).toBeGreaterThan(10);
    // Rolled clockwise, "up" points right of vertical
    expect(tilted.x).toBeGreaterThan(0.5);
  });

  it("does not depend on which eye the detector lists first", () => {
    const f = face();
    expect(anchorFromFace({ ...f, eyes: [f.eyes[1], f.eyes[0]] })).toEqual(anchorFromFace(f));
  });
});

describe("placeCap", () => {
  it("sizes the image square so the visible cap has the anchor's width", () => {
    const p = placeCap(DEFAULT_ANCHOR);
    expect(p.size * CAP_CONTENT.width).toBeCloseTo(DEFAULT_ANCHOR.width);
    expect(p).toMatchObject({ x: DEFAULT_ANCHOR.x, y: DEFAULT_ANCHOR.y, rotation: 0 });
  });

  it("adds the Customer's adjustments and keeps the centre on the photo", () => {
    const p = placeCap(DEFAULT_ANCHOR, { dx: 0.1, dy: -2, scale: 1.2, rotation: 5 });
    expect(p.x).toBeCloseTo(0.6);
    expect(p.y).toBe(LIMITS.centre[0]);
    expect(p.size * CAP_CONTENT.width).toBeCloseTo(DEFAULT_ANCHOR.width * 1.2);
    expect(p.rotation).toBe(5);
  });
});

describe("gestures", () => {
  it("drags within the photo", () => {
    const moved = applyDrag(NO_ADJUST, DEFAULT_ANCHOR, 0.1, 0.05);
    expect(moved).toMatchObject({ dx: 0.1, dy: 0.05 });
    const far = applyDrag(NO_ADJUST, DEFAULT_ANCHOR, 5, -5);
    expect(DEFAULT_ANCHOR.x + far.dx).toBeCloseTo(LIMITS.centre[1]);
    expect(DEFAULT_ANCHOR.y + far.dy).toBeCloseTo(LIMITS.centre[0]);
  });

  it("pinches within the scale and rotation limits", () => {
    expect(applyPinch(NO_ADJUST, 1.25, 10)).toMatchObject({ scale: 1.25, rotation: 10 });
    expect(applyPinch(NO_ADJUST, 10, 90)).toMatchObject({ scale: LIMITS.scale[1], rotation: LIMITS.rotation[1] });
    expect(applyPinch(NO_ADJUST, 0.01).scale).toBe(LIMITS.scale[0]);
  });

  it("measures a two-finger gesture, wrapping the turn across ±180°", () => {
    const d = pinchDelta(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ]
    );
    expect(d.ratio).toBeCloseTo(2);
    expect(d.rotation).toBeCloseTo(90);
    const wrap = pinchDelta(
      [
        { x: 0, y: 0 },
        { x: -1, y: 0.01 },
      ],
      [
        { x: 0, y: 0 },
        { x: -1, y: -0.01 },
      ]
    );
    expect(Math.abs(wrap.rotation)).toBeLessThan(2);
  });
});

describe("clampAdjust", () => {
  it("keeps slider values inside the limits and the cap on the photo", () => {
    const out = clampAdjust({ dx: 5, dy: -5, scale: 9, rotation: -90 }, DEFAULT_ANCHOR);
    expect(DEFAULT_ANCHOR.x + out.dx).toBeCloseTo(LIMITS.centre[1]);
    expect(DEFAULT_ANCHOR.y + out.dy).toBeCloseTo(LIMITS.centre[0]);
    expect(out).toMatchObject({ scale: LIMITS.scale[1], rotation: LIMITS.rotation[0] });
    expect(clampAdjust(NO_ADJUST, DEFAULT_ANCHOR)).toEqual(NO_ADJUST);
  });
});

describe("photo import and card", () => {
  it("keeps the upper part of portrait photos and the centre of landscape ones", () => {
    expect(squareCrop(1000, 2000)).toEqual({ x: 0, y: 250, width: 1000, height: 1000 });
    expect(squareCrop(3000, 2000)).toEqual({ x: 500, y: 0, width: 2000, height: 2000 });
    expect(squareCrop(800, 800)).toEqual({ x: 0, y: 0, width: 800, height: 800 });
  });

  it("downscales to PHOTO_MAX and never upscales", () => {
    expect(outputSide(4000)).toBe(PHOTO_MAX);
    expect(outputSide(600)).toBe(600);
  });

  it("lays the card out as 4:5 with the photo square on top", () => {
    const c = cardLayout(1080);
    expect(c).toMatchObject({ width: 1080, height: 1350, photo: { x: 0, y: 0, width: 1080, height: 1080 } });
    expect(c.caption.brandY).toBeGreaterThan(1080);
    expect(c.caption.nameY).toBeLessThan(1350);
  });

  it("names the saved file after the cap", () => {
    expect(cardFileName("negro-rojo")).toBe("goodluck-try-on-negro-rojo.jpg");
    expect(cardFileName("../x")).toBe("goodluck-try-on-x.jpg");
  });
});

describe("face detector", () => {
  const kp = (n: number) => Array.from({ length: 6 }, (_, i) => ({ x: n + i / 100, y: n }));

  it("uses the largest confident face, in BlazeFace keypoint order", () => {
    const f = faceFromDetections([
      { boundingBox: { width: 10, height: 10 }, categories: [{ score: 0.9 }], keypoints: kp(0.1) },
      { boundingBox: { width: 50, height: 60 }, categories: [{ score: 0.8 }], keypoints: kp(0.5) },
      { boundingBox: { width: 90, height: 90 }, categories: [{ score: 0.2 }], keypoints: kp(0.9) },
    ]);
    expect(f?.eyes[0].x).toBeCloseTo(0.5);
    expect(f?.mouth.x).toBeCloseTo(0.53);
    expect(f?.ears[1].x).toBeCloseTo(0.55);
  });

  it("returns null without a usable face", () => {
    expect(faceFromDetections([])).toBeNull();
    expect(faceFromDetections([{ keypoints: kp(0.5).slice(0, 3) }])).toBeNull();
  });

  it("pins the WASM to the installed package version", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
    expect(pkg.dependencies["@mediapipe/tasks-vision"]).toBe(MEDIAPIPE_VERSION);
  });
});

describe("TRY_ON_MODELS", () => {
  it("each model wears a real tee and has a unique id", async () => {
    const { TRY_ON_MODELS } = await import("../data/tryOnModels");
    const { SHIRT_VARIANTS } = await import("../data/caps");
    expect(new Set(TRY_ON_MODELS.map((m) => m.id)).size).toBe(TRY_ON_MODELS.length);
    for (const m of TRY_ON_MODELS) expect(SHIRT_VARIANTS.some((t) => t.id === m.teeId), m.id).toBe(true);
  });

  it("stores face points for every model, so picking one never loads the detector", async () => {
    const { TRY_ON_MODELS } = await import("../data/tryOnModels");
    for (const m of TRY_ON_MODELS) {
      expect(m.face, m.id).toBeDefined();
      const a = anchorFromFace(m.face!);
      expect(a.width, m.id).toBeGreaterThan(0.2);
      expect(a.y, m.id).toBeGreaterThan(0);
    }
  });
});
