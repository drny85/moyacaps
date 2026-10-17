/**
 * Face detector configuration and result mapping (ADR 0019), pure and tested. The loader
 * that imports MediaPipe lives in `src/components/tryon/faceDetector.ts`.
 */
import type { FaceKeypoints, Point } from "./fit";

/** Must match the pinned `@mediapipe/tasks-vision` dependency (a test checks it) */
export const MEDIAPIPE_VERSION = "1.0.1";
export const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
/** BlazeFace short range, self-hosted (230 KB) */
export const MODEL_PATH = "/models/blaze_face_short_range.tflite";

/** The parts of a MediaPipe face detection this module reads */
export interface DetectionLike {
  boundingBox?: { width: number; height: number };
  categories?: { score: number }[];
  /** BlazeFace order: right eye, left eye, nose tip, mouth, right ear, left ear (normalised) */
  keypoints: Point[];
}

/** The largest confident face's keypoints, or null when there is none */
export function faceFromDetections(detections: DetectionLike[], minScore = 0.5): FaceKeypoints | null {
  const usable = detections.filter(
    (d) => d.keypoints.length >= 6 && (d.categories?.[0]?.score ?? 1) >= minScore
  );
  if (usable.length === 0) return null;
  const area = (d: DetectionLike) => (d.boundingBox ? d.boundingBox.width * d.boundingBox.height : 0);
  const best = usable.reduce((a, b) => (area(b) > area(a) ? b : a));
  const k = best.keypoints;
  return { eyes: [k[0], k[1]], mouth: k[3], ears: [k[4], k[5]] };
}
