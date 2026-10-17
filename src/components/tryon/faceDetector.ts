/**
 * On-demand face detection for the Try-On (ADR 0019). Nothing here loads with the page:
 * MediaPipe and its WASM download the first time a photo is added, then the detector is
 * reused. The photo never leaves the device.
 */
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { MODEL_PATH, WASM_BASE, faceFromDetections } from "@/lib/tryOn/detector";
import type { FaceKeypoints } from "@/lib/tryOn/fit";

let detector: Promise<FaceDetector> | null = null;
let ready = false;

/** Whether the detector has finished downloading (the next detection starts at once) */
export function isFaceDetectorReady(): boolean {
  return ready;
}

function loadDetector(): Promise<FaceDetector> {
  if (!detector) {
    detector = (async () => {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const created = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
      ready = true;
      return created;
    })();
    // A failed download (offline, CDN blocked) can be retried with the next photo
    detector.catch(() => {
      detector = null;
    });
  }
  return detector;
}

/** Start the download early, e.g. when the Customer reaches for the upload or camera button */
export function preloadFaceDetector(): void {
  loadDetector().catch(() => {});
}

/** Keypoints of the main face in a (square) image, or null when none is found */
export async function detectFace(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<FaceKeypoints | null> {
  const d = await loadDetector();
  const result = d.detect(image);
  return faceFromDetections(result.detections);
}
