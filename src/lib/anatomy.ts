/**
 * Geometry for the Anatomy walkthrough (pure, tested): which step a scroll position is on,
 * and where a callout's leader line and label go so labels never cover the cap.
 */
import type { AnatomyCallout } from "../data/anatomy";

export type CalloutSide = "left" | "right";

/** Leader lines run out to a column near the photo edge, where the label sits */
export const LABEL_COLUMN = { left: 4, right: 96 } as const;

/** Labels on one side closer than this (in % of the photo) would collide */
export const MIN_LABEL_GAP = 9;

/** Progress range [start, end) that step `index` of `count` owns */
export function stepRange(index: number, count: number): [number, number] {
  return [index / count, (index + 1) / count];
}

/** The step a scroll progress (0..1) lands on, clamped to the last step */
export function stepAt(progress: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(progress * count)));
}

/** A callout's label goes to the photo edge nearest the detail, so the line crosses less cap */
export function calloutSide(callout: Pick<AnatomyCallout, "x">): CalloutSide {
  return callout.x < 50 ? "left" : "right";
}

export interface CalloutLayout {
  side: CalloutSide;
  /** Left edge of the leader line, % of the photo */
  lineLeft: number;
  /** Length of the leader line, % of the photo */
  lineWidth: number;
}

/** Where the leader line sits for a callout: from the dot out to its label column */
export function calloutLayout(callout: Pick<AnatomyCallout, "x">): CalloutLayout {
  const side = calloutSide(callout);
  const column = LABEL_COLUMN[side];
  return side === "left"
    ? { side, lineLeft: column, lineWidth: callout.x - column }
    : { side, lineLeft: callout.x, lineWidth: column - callout.x };
}

/**
 * Pairs of callouts whose labels would overlap: same side and vertically closer than
 * MIN_LABEL_GAP. Empty when a step's callouts are laid out cleanly.
 */
export function labelCollisions(callouts: AnatomyCallout[]): [AnatomyCallout, AnatomyCallout][] {
  const out: [AnatomyCallout, AnatomyCallout][] = [];
  for (let i = 0; i < callouts.length; i++) {
    for (let j = i + 1; j < callouts.length; j++) {
      const a = callouts[i];
      const b = callouts[j];
      if (calloutSide(a) === calloutSide(b) && Math.abs(a.y - b.y) < MIN_LABEL_GAP) out.push([a, b]);
    }
  }
  return out;
}
