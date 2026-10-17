"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";

export type CameraError = "cameraDenied" | "cameraUnavailable";

/**
 * Front-camera preview over the stage. Mounted only while open; the stream stops when it
 * closes. The preview is mirrored, and so is the photo taken from it.
 */
export function CameraSheet({
  onCapture,
  onCancel,
  onError,
}: {
  onCapture: (video: HTMLVideoElement) => void;
  onCancel: () => void;
  onError: (error: CameraError) => void;
}) {
  const t = useTranslations("tryOn");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      errorRef.current("cameraUnavailable");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop());
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.play().catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        errorRef.current(name === "NotAllowedError" || name === "SecurityError" ? "cameraDenied" : "cameraUnavailable");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="absolute inset-0 z-10 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        onLoadedData={() => setReady(true)}
        className="h-full w-full -scale-x-100 object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("cancel")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => videoRef.current && onCapture(videoRef.current)}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-display font-bold text-zinc-950 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red"
        >
          <Camera className="h-5 w-5" />
          {t("takePhoto")}
        </button>
      </div>
    </div>
  );
}
