"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { imageErrorCode } from "@/lib/admin/imageUpload";
import type { ImageErrorCode } from "@/lib/admin/imageUpload";
import { buildImageSlots, moveImage } from "@/lib/admin/imageSlots";
import type { ImageGroup } from "@/lib/admin/imageSlots";
import { ImageSlot, isFileDrag } from "./ImageSlot";
import { sectionClass, sectionTitleClass } from "./editorFields";

type Colorway = { id: string; nameEn: string; nameEs: string; catalogShot?: string };
type ProductImage = NonNullable<ReturnType<typeof useProductImages>>[number];

function useProductImages(variantId: string) {
  return useQuery(api.catalog.images.functions.listProductImages, { variantId });
}

const subTitle = "text-[11px] uppercase tracking-wide font-semibold text-zinc-500";
const moveBtn = "p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30";

/** Remove and reorder for one section, with one inline error line. */
function useImageEdits(variantId: string) {
  const t = useTranslations("admin.products.images");
  const removeImage = useMutation(api.catalog.images.functions.removeImage);
  const reorderImages = useMutation(api.catalog.images.functions.reorderImages);
  const [error, setError] = useState<ImageErrorCode | null>(null);
  const [working, setWorking] = useState(false);

  const guarded = async (fn: () => Promise<unknown>) => {
    setError(null);
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof ConvexError)) console.error("Image change failed", e);
      setError(e instanceof ConvexError ? imageErrorCode(e.data) : "unknown");
    } finally {
      setWorking(false);
    }
  };

  return {
    error,
    working,
    remove: (imageId: Id<"productImages">) => {
      if (window.confirm(t("removeConfirm"))) void guarded(() => removeImage({ imageId }));
    },
    reorder: (colorway: string | undefined, orderedIds: Id<"productImages">[]) =>
      void guarded(() => reorderImages({ variantId, role: "lifestyle", colorway, orderedIds })),
  };
}

/** The Lifestyle Shot strip: drag to reorder, or the arrow buttons from the keyboard. */
function LifestyleStrip({
  variantId,
  group,
  edits,
}: {
  variantId: string;
  group: ImageGroup<ProductImage>;
  edits: ReturnType<typeof useImageEdits>;
}) {
  const t = useTranslations("admin.products.images");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const ids = group.lifestyle.map((i) => i._id);
  const move = (from: number, to: number) => {
    if (from !== to) edits.reorder(group.colorway, moveImage(ids, from, to));
  };

  return (
    <div className="space-y-2">
      <h4 className={subTitle}>{t("lifestyleShots")}</h4>
      <ol className="flex gap-3 overflow-x-auto pb-1">
        {group.lifestyle.map((image, i) => (
          <li
            key={image._id}
            draggable={!edits.working}
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => {
              if (!isFileDrag(e) && dragFrom !== null) e.preventDefault();
            }}
            onDrop={(e) => {
              if (isFileDrag(e) || dragFrom === null) return;
              e.preventDefault();
              move(dragFrom, i);
              setDragFrom(null);
            }}
            className={`w-28 shrink-0 ${dragFrom === i ? "opacity-40" : ""}`}
          >
            <ImageSlot
              variantId={variantId}
              slot={{ role: "lifestyle", colorway: group.colorway }}
              image={image}
              label={t("lifestyleN", { n: i + 1 })}
              locked={edits.working}
              onRemove={() => edits.remove(image._id)}
            >
              <span className="flex items-center">
                <GripVertical aria-hidden className="w-3 h-3 text-zinc-400 hidden sm:block" />
                <button type="button" className={moveBtn} disabled={edits.working || i === 0} onClick={() => move(i, i - 1)} aria-label={t("moveEarlier", { n: i + 1 })}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className={moveBtn}
                  disabled={edits.working || i === ids.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label={t("moveLater", { n: i + 1 })}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </span>
            </ImageSlot>
          </li>
        ))}
        <li className="w-28 shrink-0">
          <ImageSlot variantId={variantId} slot={{ role: "lifestyle", colorway: group.colorway }} label={t("add")} locked={edits.working} />
        </li>
      </ol>
    </div>
  );
}

/**
 * The editor's image manager (D8): a big 4:5 Catalog Shot, the Lifestyle Shot strip,
 * and for a Cap the 2×2 Angle Shot grid; a tee gets one tab per Apparel Colorway.
 * Image operations save immediately.
 */
export function ProductImagesPanel({ variantId, colorways, defaultColorway, locale }: { variantId: string; colorways?: Colorway[]; defaultColorway?: string; locale: string }) {
  const t = useTranslations("admin.products.images");
  const images = useProductImages(variantId);
  const edits = useImageEdits(variantId);
  const colorwayIds = (colorways ?? []).map((c) => c.id);
  const isTee = colorwayIds.length > 0;
  const [tab, setTab] = useState<string | undefined>(defaultColorway ?? colorwayIds[0]);

  if (images === undefined) {
    return (
      <section className={sectionClass}>
        <h3 className={sectionTitleClass}>{t("title")}</h3>
        <div className="aspect-[4/5] rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
      </section>
    );
  }

  const slots = buildImageSlots(isTee ? "apparel" : "headwear", colorwayIds, images);
  const active = isTee ? (slots.groups.find((g) => g.colorway === tab) ?? slots.groups[0]) : slots.groups[0];
  const nameOf = (c: Colorway) => (locale === "es" ? c.nameEs : c.nameEn) || c.id;

  return (
    <section className={sectionClass}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={sectionTitleClass}>{t("title")}</h3>
        {edits.working && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
      </div>

      {isTee && (
        <div role="tablist" aria-label={t("colorwayTabs")} className="flex gap-1.5 overflow-x-auto pb-1">
          {colorways!.map((c) => {
            const group = slots.groups.find((g) => g.colorway === c.id);
            const selected = active.colorway === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(c.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  selected ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent" : "border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {nameOf(c)}
                {group?.missingCatalog && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label={t("missingCatalog")} />}
              </button>
            );
          })}
        </div>
      )}

      <div className="max-w-md mx-auto lg:mx-0">
        <ImageSlot
          key={active.colorway ?? "cap"}
          variantId={variantId}
          slot={{ role: "catalog", colorway: active.colorway }}
          image={active.catalog}
          label={t("catalogShot")}
          locked={edits.working}
          onRemove={active.catalog ? () => edits.remove(active.catalog!._id) : undefined}
        />
      </div>

      <LifestyleStrip key={`l-${active.colorway ?? "cap"}`} variantId={variantId} group={active} edits={edits} />

      {!isTee && (
        <div className="space-y-2">
          <h4 className={subTitle}>{t("angles")}</h4>
          {!slots.anglesComplete && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {t("anglesIncomplete")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {slots.angles.map(({ angle, image }) => (
              <ImageSlot
                key={angle}
                variantId={variantId}
                slot={{ role: "angle", angle }}
                image={image}
                label={t(`angle.${angle}`)}
                aspect="square"
                checkerboard
                locked={edits.working}
                onRemove={image ? () => edits.remove(image._id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {edits.error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {t(`errors.${edits.error}`)}
        </p>
      )}
    </section>
  );
}
