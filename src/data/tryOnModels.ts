/**
 * Sample models for the Try-On: the Customer can try a cap on one of these instead of their
 * own photo. Each wears a Good Luck tee (`teeId`), linked from the studio. Swap the photos
 * for real shoot portraits (docs/photography-spec.md) by replacing the files in
 * `public/try-on/models/` and their `face` points.
 *
 * `face` holds the detector's keypoints for the photo (fractions of the square), so a model
 * is fitted instantly without loading the detector. Without it, the studio detects at runtime.
 */
import type { FaceKeypoints } from "../lib/tryOn/fit";

export interface TryOnModel {
  id: string;
  name: string;
  /** Square photo, 1024² */
  image: string;
  teeId: string;
  face?: FaceKeypoints;
}

export const TRY_ON_MODELS: readonly TryOnModel[] = [
  {
    id: "moya",
    name: "Moya",
    image: "/try-on/models/moya-boxing.jpg",
    teeId: "boxing-gloves-tee",
    face: { eyes: [{ x: 0.4513, y: 0.3275 }, { x: 0.5516, y: 0.322 }], mouth: { x: 0.502, y: 0.4208 }, ears: [{ x: 0.3994, y: 0.3632 }, { x: 0.6132, y: 0.3558 }] },
  },
  {
    id: "devon",
    name: "Devon",
    image: "/try-on/models/devon-8ball.jpg",
    teeId: "eight-ball-tee",
    face: { eyes: [{ x: 0.4526, y: 0.3352 }, { x: 0.5566, y: 0.3362 }], mouth: { x: 0.5009, y: 0.4437 }, ears: [{ x: 0.3947, y: 0.3532 }, { x: 0.6165, y: 0.358 }] },
  },
  {
    id: "maya",
    name: "Maya",
    image: "/try-on/models/maya-butterfly.jpg",
    teeId: "butterfly-grunge-tee",
    face: { eyes: [{ x: 0.455, y: 0.3246 }, { x: 0.5588, y: 0.3261 }], mouth: { x: 0.507, y: 0.4338 }, ears: [{ x: 0.3908, y: 0.3426 }, { x: 0.612, y: 0.3458 }] },
  },
  {
    id: "jaden",
    name: "Jaden",
    image: "/try-on/models/jaden-lightning.jpg",
    teeId: "lightning-star-tee",
    face: { eyes: [{ x: 0.433, y: 0.3119 }, { x: 0.5681, y: 0.3077 }], mouth: { x: 0.4957, y: 0.4584 }, ears: [{ x: 0.3802, y: 0.3283 }, { x: 0.6624, y: 0.3243 }] },
  },
  {
    id: "marcus",
    name: "Marcus",
    image: "/try-on/models/marcus-musclecar.jpg",
    teeId: "muscle-car-tee",
    face: { eyes: [{ x: 0.4501, y: 0.3606 }, { x: 0.5556, y: 0.3571 }], mouth: { x: 0.5046, y: 0.4684 }, ears: [{ x: 0.3883, y: 0.3921 }, { x: 0.613, y: 0.3875 }] },
  },
  {
    id: "elena",
    name: "Elena",
    image: "/try-on/models/elena-angel.jpg",
    teeId: "gothic-angel-tee",
    face: { eyes: [{ x: 0.4578, y: 0.3337 }, { x: 0.5567, y: 0.3364 }], mouth: { x: 0.5051, y: 0.439 }, ears: [{ x: 0.3975, y: 0.3484 }, { x: 0.6096, y: 0.3547 }] },
  },
];
