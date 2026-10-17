/**
 * Try-On geometry (ADR 0019), pure and tested. Every position is a fraction of the square
 * Try-On Photo (0..1, y down), so the stage (CSS percentages) and the share card (canvas
 * pixels) draw the cap from the same numbers.
 */

export interface Point {
  x: number;
  y: number;
}

/** Where the cap sits before the Customer adjusts it: centre of the cap, its width, its roll */
export interface CapAnchor {
  x: number;
  y: number;
  /** Width of the visible cap (not the image square), as a fraction of the photo */
  width: number;
  /** Clockwise, in degrees */
  rotation: number;
}

/** The Customer's fine-tuning on top of the anchor */
export interface FitAdjust {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

/** The overlay image square to draw: centre, side length and clockwise rotation */
export interface CapPlacement {
  x: number;
  y: number;
  size: number;
  rotation: number;
}

/** Face keypoints from the detector, as fractions of the photo */
export interface FaceKeypoints {
  eyes: [Point, Point];
  mouth: Point;
  ears: [Point, Point];
}

/**
 * The visible cap inside every scale-normalised front angle (`/catalog/caps/{id}/front.webp`,
 * 1200²): content box (219, 264)–(981, 936). It is centred in the image.
 */
export const CAP_CONTENT = { width: 762 / 1200, height: 672 / 1200 } as const;

/** Cap height over cap width for the visible cap */
export const CAP_ASPECT = CAP_CONTENT.height / CAP_CONTENT.width;

/**
 * Calibration against real face photos (frontal, upright):
 * - the cap is this many times wider than ear-to-ear;
 * - its lower edge sits this many eye-to-mouth lengths above the eyes.
 */
export const FIT = { widthPerEarSpan: 1.45, brimAboveEyes: 0.45 } as const;

export const NO_ADJUST: FitAdjust = { dx: 0, dy: 0, scale: 1, rotation: 0 };

export const LIMITS = { scale: [0.6, 1.6], rotation: [-35, 35], centre: [0.05, 0.95] } as const;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
const deg = (rad: number) => (rad * 180) / Math.PI;
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Cap anchor for a detected face: width from the ear span, height and roll from the eyes */
export function anchorFromFace(face: FaceKeypoints): CapAnchor {
  const [a, b] = face.eyes[0].x <= face.eyes[1].x ? face.eyes : [face.eyes[1], face.eyes[0]];
  const roll = Math.atan2(b.y - a.y, b.x - a.x);
  const eyeMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const unit = dist(eyeMid, face.mouth);
  const width = dist(face.ears[0], face.ears[1]) * FIT.widthPerEarSpan;
  const height = width * CAP_ASPECT;
  // "Up" for a head rolled clockwise by `roll`
  const up = { x: Math.sin(roll), y: -Math.cos(roll) };
  const lift = unit * FIT.brimAboveEyes + height / 2;
  return { x: eyeMid.x + up.x * lift, y: eyeMid.y + up.y * lift, width, rotation: deg(roll) };
}

/** The overlay square to draw for an anchor plus the Customer's adjustments */
export function placeCap(anchor: CapAnchor, adjust: FitAdjust = NO_ADJUST): CapPlacement {
  return {
    x: clamp(anchor.x + adjust.dx, LIMITS.centre),
    y: clamp(anchor.y + adjust.dy, LIMITS.centre),
    size: (anchor.width * adjust.scale) / CAP_CONTENT.width,
    rotation: anchor.rotation + adjust.rotation,
  };
}

/** Moving the cap by a drag of (dx, dy), as fractions of the stage */
export function applyDrag(adjust: FitAdjust, anchor: CapAnchor, dx: number, dy: number): FitAdjust {
  const [lo, hi] = LIMITS.centre;
  return {
    ...adjust,
    dx: clamp(adjust.dx + dx, [lo - anchor.x, hi - anchor.x]),
    dy: clamp(adjust.dy + dy, [lo - anchor.y, hi - anchor.y]),
  };
}

/** Resizing and turning the cap with a two-finger pinch (or the wheel on desktop) */
export function applyPinch(adjust: FitAdjust, scaleRatio: number, rotationDelta = 0): FitAdjust {
  return {
    ...adjust,
    scale: clamp(adjust.scale * scaleRatio, LIMITS.scale),
    rotation: clamp(adjust.rotation + rotationDelta, LIMITS.rotation),
  };
}

/** Scale ratio and rotation change between two positions of a two-finger gesture */
export function pinchDelta(from: [Point, Point], to: [Point, Point]): { ratio: number; rotation: number } {
  const d0 = dist(from[0], from[1]);
  const d1 = dist(to[0], to[1]);
  const a0 = Math.atan2(from[1].y - from[0].y, from[1].x - from[0].x);
  const a1 = Math.atan2(to[1].y - to[0].y, to[1].x - to[0].x);
  let turn = deg(a1 - a0);
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  return { ratio: d0 > 0 ? d1 / d0 : 1, rotation: turn };
}

/**
 * The face of the head silhouette shown before a photo is added (`HeadSilhouette` draws
 * its head around these points), so the default placement uses the same fit as a photo.
 */
export const SILHOUETTE_FACE: FaceKeypoints = {
  eyes: [
    { x: 0.43, y: 0.54 },
    { x: 0.57, y: 0.54 },
  ],
  mouth: { x: 0.5, y: 0.67 },
  ears: [
    { x: 0.33, y: 0.57 },
    { x: 0.67, y: 0.57 },
  ],
};

/** Placement on the head silhouette */
export const DEFAULT_ANCHOR: CapAnchor = anchorFromFace(SILHOUETTE_FACE);

/** Any adjustment brought inside the limits (the fine-tune sliders set fields directly) */
export function clampAdjust(adjust: FitAdjust, anchor: CapAnchor): FitAdjust {
  const [lo, hi] = LIMITS.centre;
  return {
    dx: clamp(adjust.dx, [lo - anchor.x, hi - anchor.x]),
    dy: clamp(adjust.dy, [lo - anchor.y, hi - anchor.y]),
    scale: clamp(adjust.scale, LIMITS.scale),
    rotation: clamp(adjust.rotation, LIMITS.rotation),
  };
}
