"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { CapAngle, ImageRole } from "@convex/catalog/images/rules";
import { imageErrorCode, preflightImage } from "@/lib/admin/imageUpload";
import { CropGuide } from "./CropGuide";

type Colorway = { id: string; nameEn: string; nameEs: string };
type Slot = { role: ImageRole; colorway?: string; angle?: CapAngle };
type ProductImage = NonNullable<ReturnType<typeof useImages>>[number];

const ANGLES: readonly CapAngle[] = ["front", "left", "back", "right"];

function useImages(variantId: string) {
  return useQuery(api.catalog.images.functions.listProductImages, { variantId });
}

const btn =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors";

/** Shared upload flow: pick, preflight, crop preview, confirm, upload, attach. */
function useSlotUpload(variantId: string, slot: Slot, onError: (code: string) => void) {
  const generateUploadUrl = useMutation(api.catalog.admin.generateUploadUrl);
  const attachImage = useAction(api.catalog.images.attach.attachImage);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const pendingUrl = useRef<string | null>(null);
  useEffect(() => {
    pendingUrl.current = pending?.url ?? null;
  }, [pending]);
  useEffect(() => () => {
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
  }, []);

  const pick = async (file: File) => {
    onError("");
    const failure = await preflightImage(file, slot.role);
    if (failure) return onError(failure);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const confirm = async (replaceImageId?: Id<"productImages">) => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(await generateUploadUrl(), {
        method: "POST",
        headers: { "Content-Type": pending.file.type || "application/octet-stream" },
        body: pending.file,
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await attachImage({ variantId, storageId, ...slot, replaceImageId });
      clear();
    } catch (e) {
      onError(e instanceof ConvexError ? imageErrorCode(e.data) : "unknown");
    } finally {
      setBusy(false);
    }
  };

  return { pending, busy, pick, confirm, cancel: clear };
}

function ImageCard({
  image,
  alt,
  label,
  busy,
  onRemove,
  onMove,
  tall = true,
}: {
  image?: ProductImage;
  alt: string;
  label: string;
  busy?: boolean;
  onRemove?: () => void;
  onMove?: { up?: () => void; down?: () => void };
  tall?: boolean;
}) {
  const t = useTranslations("admin.products.images");
  return (
    <div className="w-40 shrink-0 space-y-1.5">
      <div
        className={`w-40 ${tall ? "aspect-[4/5]" : "aspect-square"} rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center`}
      >
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, admin only
          <img src={image.url} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] text-zinc-500 px-2 text-center">{t("empty")}</span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">{label}</p>
      {image && onMove && (
        <div className="flex gap-1">
          <button type="button" className={btn} disabled={busy || !onMove.up} onClick={onMove.up} aria-label={t("moveUp")}>
            <ArrowUp className="w-3 h-3" />
          </button>
          <button type="button" className={btn} disabled={busy || !onMove.down} onClick={onMove.down} aria-label={t("moveDown")}>
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      )}
      {image && onRemove && (
        <button type="button" className={btn} disabled={busy} onClick={onRemove}>
          <Trash2 className="w-3 h-3" /> {busy ? t("removing") : t("remove")}
        </button>
      )}
    </div>
  );
}

/** One upload slot: an occupied or empty card with pick, preview and confirm. */
function SlotUploader({
  variantId,
  slot,
  image,
  label,
  onRemove,
  onMove,
  addLabelKey,
  locked = false,
}: {
  variantId: string;
  slot: Slot;
  image?: ProductImage;
  label: string;
  onRemove?: () => void;
  onMove?: { up?: () => void; down?: () => void };
  addLabelKey?: "add";
  /** A remove or reorder is in flight for this section. */
  locked?: boolean;
}) {
  const t = useTranslations("admin.products.images");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { pending, busy, pick, confirm, cancel } = useSlotUpload(variantId, slot, setError);
  const isAngle = slot.role === "angle";

  return (
    <div className="space-y-1.5">
      {pending ? (
        <div className="w-40 space-y-1.5">
          {isAngle ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL
            <img src={pending.url} alt={label} className="w-40 rounded-xl bg-zinc-100 dark:bg-white/5" />
          ) : (
            <>
              <CropGuide src={pending.url} alt={label} />
              <p className="text-[10px] text-zinc-500">{t("cropHint")}</p>
            </>
          )}
          <div className="flex gap-1">
            <button type="button" className={btn} disabled={busy} onClick={() => confirm(image?._id)}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {busy ? t("busy") : t("confirmUpload")}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={cancel}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <ImageCard image={image} alt={label} label={label} busy={busy || locked} onRemove={onRemove} onMove={onMove} tall={!isAngle} />
          <button type="button" className={btn} disabled={locked} onClick={() => input.current?.click()}>
            <Upload className="w-3 h-3" /> {addLabelKey ? t(addLabelKey) : image ? t("replace") : t("upload")}
          </button>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {error && (
        <p role="alert" className="w-40 text-[11px] text-moya-red">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

function sameColorway(a: string | undefined, b: string | undefined) {
  return (a ?? undefined) === (b ?? undefined);
}

function ColorwaySection({
  variantId,
  title,
  colorway,
  images,
  withAngles,
}: {
  variantId: string;
  title?: string;
  colorway?: string;
  images: ProductImage[];
  withAngles: boolean;
}) {
  const t = useTranslations("admin.products.images");
  const removeImage = useMutation(api.catalog.images.functions.removeImage);
  const reorderImages = useMutation(api.catalog.images.functions.reorderImages);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const mine = images.filter((i) => sameColorway(i.colorway, colorway));
  const catalog = mine.find((i) => i.role === "catalog");
  const lifestyle = mine.filter((i) => i.role === "lifestyle");

  const guarded = async (fn: () => Promise<unknown>) => {
    setError("");
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ConvexError ? imageErrorCode(e.data) : "unknown");
    } finally {
      setWorking(false);
    }
  };

  const remove = (id: Id<"productImages">) => {
    if (!window.confirm(t("removeConfirm"))) return;
    void guarded(() => removeImage({ imageId: id }));
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = lifestyle.map((i) => i._id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    void guarded(() => reorderImages({ variantId, role: "lifestyle", colorway, orderedIds: ids }));
  };

  return (
    <section className="space-y-3">
      {title && <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">{title}</h4>}
      <div className="space-y-1">
        <h5 className="text-[11px] uppercase tracking-wide text-zinc-500">{t("catalogShot")}</h5>
        <SlotUploader
            locked={working}
          variantId={variantId}
          slot={{ role: "catalog", colorway }}
          image={catalog}
          label={t("catalogShot")}
          onRemove={catalog ? () => remove(catalog._id) : undefined}
        />
      </div>
      <div className="space-y-1">
        <h5 className="text-[11px] uppercase tracking-wide text-zinc-500">{t("lifestyleShots")}</h5>
        <div className="flex flex-wrap gap-3 items-start">
          {lifestyle.map((image, i) => (
            <SlotUploader
            locked={working}
              key={image._id}
              variantId={variantId}
              slot={{ role: "lifestyle", colorway }}
              image={image}
              label={`${t("lifestyleShots")} ${i + 1}`}
              onRemove={() => remove(image._id)}
              onMove={{
                up: i > 0 ? () => move(i, -1) : undefined,
                down: i < lifestyle.length - 1 ? () => move(i, 1) : undefined,
              }}
            />
          ))}
          <SlotUploader
            locked={working}
            variantId={variantId}
            slot={{ role: "lifestyle", colorway }}
            label={t("lifestyleShots")}
            addLabelKey="add"
          />
        </div>
      </div>
      {withAngles && (
        <div className="space-y-1">
          <h5 className="text-[11px] uppercase tracking-wide text-zinc-500">{t("angles")}</h5>
          <div className="flex flex-wrap gap-3 items-start">
            {ANGLES.map((angle) => {
              const image = mine.find((i) => i.role === "angle" && i.angle === angle);
              return (
                <SlotUploader
            locked={working}
                  key={angle}
                  variantId={variantId}
                  slot={{ role: "angle", colorway, angle }}
                  image={image}
                  label={t(`angle.${angle}`)}
                  onRemove={image ? () => remove(image._id) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
      {working && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
      {error && (
        <p role="alert" className="text-[11px] text-moya-red">
          {t(`errors.${error}`)}
        </p>
      )}
    </section>
  );
}

export function ProductImagesPanel({
  variantId,
  colorways,
  locale,
}: {
  variantId: string;
  colorways?: Colorway[];
  locale: string;
}) {
  const t = useTranslations("admin.products.images");
  const images = useImages(variantId);
  const isTee = Boolean(colorways?.length);

  return (
    <section className="pt-3 border-t border-zinc-100 dark:border-white/[0.06] space-y-4">
      <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">{t("title")}</h3>
      {images === undefined ? (
        <p className="text-[11px] text-zinc-500">{t("loading")}</p>
      ) : isTee ? (
        colorways!.map((c) => (
          <ColorwaySection
            key={c.id}
            variantId={variantId}
            title={locale === "es" ? c.nameEs : c.nameEn}
            colorway={c.id}
            images={images}
            withAngles={false}
          />
        ))
      ) : (
        <ColorwaySection variantId={variantId} images={images} withAngles />
      )}
    </section>
  );
}
