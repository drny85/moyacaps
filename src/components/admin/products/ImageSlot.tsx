"use client";

import React, { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { AdminModal } from "@/components/admin/AdminModal";
import { CHECKERBOARD, CropGuide } from "./CropGuide";
import { useImageUpload } from "./useImageUpload";
import type { ImageSlotKey } from "./useImageUpload";

export type SlotImage = { _id: Id<"productImages">; url?: string | null };

const ACCEPT = "image/png,image/jpeg,image/webp";

/** True when a drag carries files from the desktop (not a Lifestyle Shot being reordered). */
export const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/**
 * One image slot (D8): a drop or tap target. Empty, it uploads; filled, it shows the
 * image with Replace and Remove. Every upload goes through the Crop Guide review.
 */
export function ImageSlot({
  variantId,
  slot,
  image,
  label,
  aspect = "portrait",
  checkerboard = false,
  locked = false,
  onRemove,
  className = "",
  children,
}: {
  variantId: string;
  slot: ImageSlotKey;
  image?: SlotImage;
  label: string;
  aspect?: "portrait" | "square";
  checkerboard?: boolean;
  /** A remove or reorder is in flight in this section. */
  locked?: boolean;
  onRemove?: () => void;
  className?: string;
  /** Extra controls under the image (reorder buttons). */
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.products.images");
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const upload = useImageUpload(variantId, slot);
  const titleId = useId();
  const busy = locked || upload.uploading;

  const onDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !busy) void upload.pick(file);
  };

  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <div
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative ${aspect === "portrait" ? "aspect-[4/5]" : "aspect-square"} rounded-xl overflow-hidden border ${
          dragOver ? "border-moya-red ring-2 ring-moya-red/40" : image ? "border-zinc-200 dark:border-white/10" : "border-dashed border-zinc-300 dark:border-white/15"
        } ${checkerboard ? CHECKERBOARD : "bg-zinc-100 dark:bg-white/[0.04]"}`}
      >
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, admin only
          <img src={image.url} alt={label} className={`w-full h-full ${checkerboard ? "object-contain" : "object-cover"}`} />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 p-2 text-center"
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-[11px] font-medium">{t("dropOrTap")}</span>
          </button>
        )}
        {image && (
          <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end bg-gradient-to-t from-black/60 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
            <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={`${t("replace")}: ${label}`} className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {onRemove && (
              <button type="button" disabled={busy} onClick={onRemove} aria-label={`${t("remove")}: ${label}`} className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {upload.uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{label}</p>
        {children}
      </div>
      {upload.error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {t(`errors.${upload.error}`)}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload.pick(file);
        }}
      />

      <AdminModal isOpen={upload.review !== null} onClose={upload.cancel} isProcessing={upload.uploading} labelledBy={titleId} maxWidthClass="max-w-md">
        <h3 id={titleId} className="font-display font-bold text-lg text-zinc-900 dark:text-white">
          {t("reviewTitle", { slot: label })}
        </h3>
        {upload.review && (
          <CropGuide
            src={upload.review.url}
            alt={label}
            role={slot.role}
            checks={upload.review.report.checks}
            busy={upload.uploading}
            onUpload={() => void upload.confirm(image?._id)}
            onCancel={upload.cancel}
          />
        )}
        {upload.error && upload.review && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {t(`errors.${upload.error}`)}
          </p>
        )}
      </AdminModal>
    </div>
  );
}
