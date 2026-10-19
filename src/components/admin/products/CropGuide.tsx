"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Upload, X } from "lucide-react";
import type { ImageRole } from "@convex/catalog/images/rules";
import { MAX_IMAGE_BYTES, MIN_SHORT_SIDE } from "@convex/catalog/images/rules";
import { fitCropBox } from "@/lib/admin/cropFrame";
import type { PreflightCheck } from "@/lib/admin/imageUpload";

const CHECKERBOARD = "bg-[conic-gradient(#e4e4e7_25%,#fafafa_0_50%,#e4e4e7_0_75%,#fafafa_0)] bg-[length:16px_16px]";

/**
 * Upload review (D8): the local preview with the storefront's centred 4:5 frame (Angle
 * Shots show on a checkerboard instead) and the pass/fail preflight checklist. It only
 * advises: the file is uploaded as is, never cropped or altered.
 */
export function CropGuide({
  src,
  alt,
  role,
  checks,
  busy,
  onUpload,
  onCancel,
}: {
  src: string;
  alt: string;
  role: ImageRole;
  checks: PreflightCheck[];
  busy: boolean;
  onUpload: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.products.images");
  const [frame, setFrame] = useState<{ widthPct: number; heightPct: number } | null>(null);
  const isAngle = role === "angle";
  const allPass = checks.every((c) => c.pass);
  const label = (id: PreflightCheck["id"]) =>
    t(`checks.${id}`, { maxMb: MAX_IMAGE_BYTES / (1024 * 1024), minPx: MIN_SHORT_SIDE });

  return (
    <div className="space-y-4">
      <div className={`relative w-full overflow-hidden rounded-xl ${isAngle ? CHECKERBOARD : "bg-zinc-100 dark:bg-white/5"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        <img
          src={src}
          alt={alt}
          className="block w-full h-auto max-h-[60vh] object-contain"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            const box = fitCropBox(w, h);
            setFrame({ widthPct: (box.width / w) * 100, heightPct: (box.height / h) * 100 });
          }}
        />
        {frame && !isAngle && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{ width: `${frame.widthPct}%`, height: `${frame.heightPct}%` }}
              data-testid="crop-frame"
            />
          </div>
        )}
      </div>
      {!isAngle && <p className="text-[11px] text-zinc-500">{t("cropHint")}</p>}

      <ul className="space-y-1.5 text-xs" aria-label={t("checklist")}>
        {checks.map((c) => (
          <li key={c.id} className={`flex items-center gap-2 ${c.pass ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {c.pass ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            <span>{label(c.id)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-500">{t("adviceOnly")}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={busy || !allPass}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {busy ? t("busy") : t("confirmUpload")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

export { CHECKERBOARD };
