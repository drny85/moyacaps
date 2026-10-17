/**
 * "The Anatomy of 0880": the four real angle photos of the signature cap and the craft
 * details called out on each. Callout x/y are percentages of the square photo (left/top),
 * placed on the detail itself; `label`, `title`, `desc` and `spec` are keys under the
 * `anatomy` message namespace.
 */
import type { CapAngleKey } from "./capsManifest";

export interface AnatomyCallout {
  x: number;
  y: number;
  /** Message key under `anatomy.callouts` */
  label: string;
}

export interface AnatomyStep {
  key: "front" | "flanks" | "back" | "structure";
  angle: CapAngleKey;
  image: string;
  title: string;
  desc: string;
  /** The one hard number or fact for the spec-sheet row (message key) */
  spec: string;
  callouts: AnatomyCallout[];
}

export const ANATOMY_STEPS: readonly AnatomyStep[] = [
  {
    key: "front",
    angle: "front",
    image: "/caps/angles/front.png",
    title: "layer1Title",
    desc: "layer1Desc",
    spec: "layer1Spec",
    callouts: [
      { x: 51, y: 40, label: "puff" },
      { x: 57, y: 58, label: "banner" },
      { x: 60, y: 82, label: "visor" },
    ],
  },
  {
    key: "flanks",
    angle: "left",
    image: "/caps/angles/left.png",
    title: "layer2Title",
    desc: "layer2Desc",
    spec: "layer2Spec",
    callouts: [
      { x: 34, y: 50, label: "devil" },
      { x: 52, y: 47, label: "pitchfork" },
      { x: 36, y: 28, label: "eyelet" },
    ],
  },
  {
    key: "back",
    angle: "back",
    image: "/caps/angles/back.png",
    title: "layer3Title",
    desc: "layer3Desc",
    spec: "layer3Spec",
    callouts: [
      { x: 50, y: 43, label: "script" },
      { x: 50, y: 76, label: "snap" },
      { x: 50, y: 13, label: "button" },
    ],
  },
  {
    key: "structure",
    angle: "right",
    image: "/caps/angles/right.png",
    title: "layer4Title",
    desc: "layer4Desc",
    spec: "layer4Spec",
    callouts: [
      { x: 55, y: 20, label: "seam" },
      { x: 26, y: 42, label: "buckram" },
      { x: 20, y: 64, label: "curve" },
    ],
  },
];
