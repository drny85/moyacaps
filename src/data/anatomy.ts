/**
 * "The Anatomy of the Heavyweight": one photo of the signature tee and the craft details
 * called out on it, one step at a time. Callout x/y are percentages of the photo (left/top),
 * placed on the detail itself; `label`, `title`, `desc` and `spec` are keys under the
 * `anatomy` message namespace.
 */

export interface AnatomyCallout {
  x: number;
  y: number;
  /** Message key under `anatomy.callouts` */
  label: string;
}

export interface AnatomyStep {
  key: "weight" | "print" | "fit" | "collar";
  image: string;
  title: string;
  desc: string;
  /** The one hard number or fact for the spec-sheet row (message key) */
  spec: string;
  callouts: AnatomyCallout[];
  /**
   * Where the source photo crops the subject with a straight vertical edge, as % of the photo
   * width from the left. Those edges fade out instead of ending in a hard line.
   */
  cutEdges?: CutEdges;
}

export interface CutEdges {
  left?: number;
  right?: number;
}

/** The tee photo every step calls out on, with its pixel size (the stage keeps this aspect) */
export const ANATOMY_PHOTO = {
  src: "/tees/anatomy/heavyweight-tee.webp",
  width: 1600,
  height: 1790,
} as const;

export const ANATOMY_STEPS: readonly AnatomyStep[] = [
  {
    key: "weight",
    image: ANATOMY_PHOTO.src,
    title: "layer1Title",
    desc: "layer1Desc",
    spec: "layer1Spec",
    callouts: [
      { x: 24, y: 59, label: "wash" },
      { x: 86, y: 56, label: "cotton" },
    ],
  },
  {
    key: "print",
    image: ANATOMY_PHOTO.src,
    title: "layer2Title",
    desc: "layer2Desc",
    spec: "layer2Spec",
    callouts: [
      { x: 38, y: 40, label: "script" },
      { x: 56, y: 59, label: "artwork" },
      { x: 62, y: 87, label: "hemPrint" },
    ],
  },
  {
    key: "fit",
    image: ANATOMY_PHOTO.src,
    title: "layer3Title",
    desc: "layer3Desc",
    spec: "layer3Spec",
    callouts: [
      { x: 20, y: 43, label: "shoulder" },
      { x: 90, y: 61, label: "sleeve" },
      { x: 34, y: 86, label: "hem" },
    ],
  },
  {
    key: "collar",
    image: ANATOMY_PHOTO.src,
    title: "layer4Title",
    desc: "layer4Desc",
    spec: "layer4Spec",
    callouts: [
      { x: 41, y: 28, label: "rib" },
      { x: 62, y: 26, label: "neckline" },
    ],
  },
];
