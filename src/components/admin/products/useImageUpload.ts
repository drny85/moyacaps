"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { CapAngle, ImageRole } from "@convex/catalog/images/rules";
import { imageErrorCode, preflightReport } from "@/lib/admin/imageUpload";
import type { ImageErrorCode, PreflightReport } from "@/lib/admin/imageUpload";

export type ImageSlotKey = { role: ImageRole; colorway?: string; angle?: CapAngle };

export type UploadReview = { file: File; url: string; report: PreflightReport };

/**
 * One slot's upload (D8): pick or drop a file, preflight it for the Crop Guide review,
 * then upload URL → POST → `attachImage`. The server re-checks every rule.
 */
export function useImageUpload(variantId: string, slot: ImageSlotKey) {
  const generateUploadUrl = useMutation(api.catalog.admin.generateUploadUrl);
  const attachImage = useAction(api.catalog.images.attach.attachImage);
  const [review, setReview] = useState<UploadReview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ImageErrorCode | null>(null);

  // Revoke the preview's object URL when it is replaced or the slot unmounts.
  const previewUrl = useRef<string | null>(null);
  useEffect(() => {
    const previous = previewUrl.current;
    previewUrl.current = review?.url ?? null;
    if (previous && previous !== previewUrl.current) URL.revokeObjectURL(previous);
  }, [review]);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    []
  );

  const pick = async (file: File) => {
    setError(null);
    const report = await preflightReport(file, slot.role);
    setReview({ file, url: URL.createObjectURL(file), report });
  };

  const confirm = async (replaceImageId?: Id<"productImages">) => {
    if (!review || review.report.error) return;
    setUploading(true);
    try {
      const res = await fetch(await generateUploadUrl(), {
        method: "POST",
        headers: { "Content-Type": review.file.type || "application/octet-stream" },
        body: review.file,
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await attachImage({ variantId, storageId, ...slot, replaceImageId });
      setReview(null);
    } catch (e) {
      if (!(e instanceof ConvexError)) console.error("Image upload failed", e);
      setError(e instanceof ConvexError ? imageErrorCode(e.data) : "unknown");
    } finally {
      setUploading(false);
    }
  };

  return {
    review,
    uploading,
    error,
    pick,
    confirm,
    cancel: () => {
      setReview(null);
      setError(null);
    },
    clearError: () => setError(null),
  };
}
