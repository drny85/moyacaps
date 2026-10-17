"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Check, Download, RotateCcw, Share2, Upload, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { getCapFrontOverlay } from "@/lib/capAngles";
import { initialTryOnCap, tryOnCaps, type TryOnCap } from "@/lib/tryOn/catalog";
import { DEFAULT_ANCHOR, NO_ADJUST, anchorFromFace, placeCap, type CapAnchor, type FitAdjust } from "@/lib/tryOn/fit";
import { CapPicker } from "./CapPicker";
import { CameraSheet, type CameraError } from "./CameraSheet";
import { TryOnStage } from "./TryOnStage";
import { detectFace, isFaceDetectorReady, preloadFaceDetector } from "./faceDetector";
import { photoFromFile, photoFromVideo, type TryOnPhoto } from "./photoImport";

type Status =
  | "empty"
  | "loadingTool"
  | "detecting"
  | "fitted"
  | "noFace"
  | "toolFailed"
  | "photoFailed"
  | CameraError;

const BUSY: Status[] = ["loadingTool", "detecting"];

/** next/font family names are hashed; read the real stacks for the canvas card */
function pageFonts() {
  const root = getComputedStyle(document.documentElement);
  const pick = (v: string, fallback: string) => `${root.getPropertyValue(v).trim() || ""}${root.getPropertyValue(v).trim() ? ", " : ""}${fallback}`;
  return { display: pick("--font-poster", "Impact, sans-serif"), body: pick("--font-sans", "system-ui, sans-serif") };
}

/**
 * The Try-On (ADR 0019): a cap from the live catalog placed on the Customer's own photo by
 * on-device face detection, fine-tuned by hand, then added to the bag or shared. The page
 * and the product-page modal both render this.
 */
export function TryOnStudio({
  initialCapId,
  onClose,
  headingId,
  as: Heading = "h1",
}: {
  initialCapId?: string | null;
  onClose?: () => void;
  headingId?: string;
  as?: "h1" | "h2";
}) {
  const t = useTranslations("tryOn");
  const locale = useLocale();
  const addToCart = useStore((s) => s.addToCart);
  const { caps: catalog } = useCapVariants();
  const now = useMinuteClock();
  const caps = useMemo(() => tryOnCaps(catalog, now, getCapFrontOverlay), [catalog, now]);

  const [selectedId, setSelectedId] = useState<string | null>(initialCapId ?? null);
  const selected: TryOnCap | null = caps.find((c) => c.product.id === selectedId) ?? initialTryOnCap(caps, initialCapId);

  const [photo, setPhoto] = useState<TryOnPhoto | null>(null);
  const [anchor, setAnchor] = useState<CapAnchor>(DEFAULT_ANCHOR);
  const [adjust, setAdjust] = useState<FitAdjust>(NO_ADJUST);
  const [status, setStatus] = useState<Status>("empty");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  const placement = placeCap(anchor, adjust);

  // The Try-On Photo lives only in memory: revoke the old URL when it is replaced or the studio closes
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  useEffect(() => {
    try {
      const probe = new File([new Blob()], "probe.jpg", { type: "image/jpeg" });
      setCanShareFiles(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(id);
  }, [added]);

  const fitPhoto = async (next: TryOnPhoto) => {
    const run = ++runRef.current;
    setPhoto(next);
    setAnchor(DEFAULT_ANCHOR);
    setAdjust(NO_ADJUST);
    setCameraOpen(false);
    setStatus(isFaceDetectorReady() ? "detecting" : "loadingTool");
    try {
      const face = await detectFace(next.canvas);
      if (run !== runRef.current) return;
      if (face) {
        setAnchor(anchorFromFace(face));
        setStatus("fitted");
      } else {
        setStatus("noFace");
      }
    } catch {
      if (run === runRef.current) setStatus("toolFailed");
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    photoFromFile(file)
      .then(fitPhoto)
      .catch(() => setStatus("photoFailed"));
  };

  const onCapture = (video: HTMLVideoElement) => {
    photoFromVideo(video)
      .then(fitPhoto)
      .catch(() => setStatus("photoFailed"));
  };

  const onCameraError = (error: CameraError) => {
    setCameraOpen(false);
    setStatus(error);
  };

  const onAdd = () => {
    if (!selected?.purchasable) return;
    addToCart(selected.product, 1, selected.product.stock);
    setAdded(true);
  };

  const onShare = async () => {
    if (!photo || !selected || sharing) return;
    setSharing(true);
    try {
      const { renderCard, shareOrSave } = await import("./shareCard");
      const name = locale === "es" ? selected.product.nameEs : selected.product.nameEn;
      const blob = await renderCard({
        photoUrl: photo.url,
        overlayUrl: selected.overlay,
        placement,
        capId: selected.product.id,
        capName: name.split(" / ")[0],
        price: `$${selected.product.priceUsd}`,
        brand: t("cardBrand"),
        fonts: pageFonts(),
      });
      await shareOrSave(blob, selected.product.id, name);
    } finally {
      setSharing(false);
    }
  };

  const capName = selected ? (locale === "es" ? selected.product.nameEs : selected.product.nameEn) : "";
  const busy = BUSY.includes(status);
  const adjusted = adjust !== NO_ADJUST;
  const reach = { onPointerEnter: preloadFaceDetector, onFocus: preloadFaceDetector };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading id={headingId} className="font-poster text-5xl uppercase leading-[0.9] text-zinc-950 dark:text-white sm:text-6xl">
            {t("title")}
          </Heading>
          <p className="mt-3 max-w-md text-base text-zinc-600 dark:text-zinc-400">{t("intro")}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/15 dark:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          {selected && (
            <TryOnStage
              photoUrl={photo?.url ?? null}
              overlay={selected.overlay}
              label={t(photo ? "stageLabel" : "silhouetteLabel", { cap: capName })}
              handleLabel={t("capHandle", { cap: capName })}
              anchor={anchor}
              placement={placement}
              onAdjust={(update) => setAdjust((prev) => update(prev))}
              cover={cameraOpen ? <CameraSheet onCapture={onCapture} onCancel={() => setCameraOpen(false)} onError={onCameraError} /> : undefined}
              status={
                busy ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    {t(status)}
                  </span>
                ) : undefined
              }
            />
          )}

          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-zinc-600 dark:text-zinc-400">
            {busy ? "" : t(status === "empty" ? "emptyHint" : status)}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <PhotoButton onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />} primary={!photo} {...reach}>
              {photo ? t("changePhoto") : t("upload")}
            </PhotoButton>
            <PhotoButton onClick={() => setCameraOpen(true)} icon={<Camera className="h-4 w-4" />} disabled={cameraOpen} {...reach}>
              {t("camera")}
            </PhotoButton>
            {adjusted && (
              <PhotoButton onClick={() => setAdjust(NO_ADJUST)} icon={<RotateCcw className="h-4 w-4" />}>
                {t("reset")}
              </PhotoButton>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:col-span-5">
          {selected && (
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-poster text-3xl uppercase leading-none text-zinc-950 dark:text-white">{capName.split(" / ")[0]}</p>
              <p className="font-display text-xl font-bold tabular-nums text-zinc-950 dark:text-white">${selected?.product.priceUsd}</p>
            </div>
          )}
          <div className="mt-4">
            <CapPicker
              caps={caps}
              selectedId={selected?.product.id ?? null}
              onSelect={(c) => {
                setSelectedId(c.product.id);
                setAdded(false);
              }}
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-black/[0.06] bg-white/90 px-4 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-zinc-950/90 sm:mx-0 sm:px-0 lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={!selected?.purchasable && !added}
                aria-live="polite"
                className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-display text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 lg:h-14 lg:text-base ${
                  added
                    ? "bg-moya-green text-white"
                    : selected?.purchasable
                      ? "bg-moya-red text-white hover:bg-moya-red-deep"
                      : "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                }`}
              >
                {added ? (
                  <>
                    <Check className="h-5 w-5" />
                    {t("added")}
                  </>
                ) : selected?.purchasable ? (
                  t("addToBag", { price: `$${selected.product.priceUsd}` })
                ) : (
                  t("notAvailable")
                )}
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={onShare}
                  disabled={sharing}
                  aria-label={sharing ? t("preparing") : canShareFiles ? t("share") : t("save")}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-800 hover:border-zinc-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/15 dark:text-zinc-200 dark:hover:border-white lg:h-14 lg:w-auto lg:gap-2 lg:px-5"
                >
                  {canShareFiles ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
                  <span className="hidden text-sm font-semibold lg:inline">{sharing ? t("preparing") : canShareFiles ? t("share") : t("save")}</span>
                </button>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-500">{t("privacy")}</p>
        </div>
      </div>
    </div>
  );
}

function PhotoButton({
  onClick,
  icon,
  children,
  primary = false,
  disabled = false,
  ...rest
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onPointerEnter?: () => void;
  onFocus?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
        primary
          ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
          : "border border-zinc-300 text-zinc-800 hover:border-zinc-900 dark:border-white/15 dark:text-zinc-200 dark:hover:border-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
