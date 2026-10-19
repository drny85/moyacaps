"use client";

import { useState } from "react";
import { cropFrame } from "@/lib/admin/cropFrame";

/** Local preview with the storefront's centred 4:5 crop frame; everything outside it is dimmed. */
export function CropGuide({ src, alt }: { src: string; alt: string }) {
  const [frame, setFrame] = useState<ReturnType<typeof cropFrame> | null>(null);
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img
        src={src}
        alt={alt}
        className="block w-full h-auto"
        onLoad={(e) => setFrame(cropFrame(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))}
      />
      {frame && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{ width: `${frame.widthPct}%`, height: `${frame.heightPct}%` }}
            data-testid="crop-frame"
          />
        </div>
      )}
    </div>
  );
}
