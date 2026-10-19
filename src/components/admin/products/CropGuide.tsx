"use client";

/** Local preview with the storefront's 4:5 crop frame; everything outside the frame is dimmed. */
export function CropGuide({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img src={src} alt={alt} className="block w-full h-auto" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="h-full max-w-full aspect-[4/5] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
          data-testid="crop-frame"
        />
      </div>
    </div>
  );
}
