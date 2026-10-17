"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Check, Download, RotateCcw, Share2, SlidersHorizontal, Upload, X } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { TRY_ON_MODELS, type TryOnModel } from "@/data/tryOnModels";
import { useStore } from "@/store/useStore";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { getCapFrontOverlay } from "@/lib/capAngles";
import { initialTryOnCap, tryOnCaps, type TryOnCap } from "@/lib/tryOn/catalog";
import { DEFAULT_ANCHOR, NO_ADJUST, anchorFromFace, clampAdjust, placeCap, type CapAnchor, type FitAdjust } from "@/lib/tryOn/fit";
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

  // The Customer's own photo, or else a sample model (the first one to start)
  const [photo, setPhoto] = useState<TryOnPhoto | null>(null);
  const [modelId, setModelId] = useState<string | null>(TRY_ON_MODELS[0]?.id ?? null);
  const model = photo ? null : TRY_ON_MODELS.find((m) => m.id === modelId) ?? null;
  const [anchor, setAnchor] = useState<CapAnchor>(() => modelAnchor(TRY_ON_MODELS[0]));
  const [fineTune, setFineTune] = useState(false);
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

  // A model without stored face points is detected once, like a photo
  useEffect(() => {
    if (!model || model.face) return;
    const run = ++runRef.current;
    const img = new window.Image();
    img.src = model.image;
    img
      .decode()
      .then(() => detectFace(img))
      .then((face) => {
        if (run === runRef.current && face) setAnchor(anchorFromFace(face));
      })
      .catch(() => {});
  }, [model]);

  const chooseModel = (next: TryOnModel) => {
    runRef.current++;
    setPhoto(null);
    setModelId(next.id);
    setAnchor(modelAnchor(next));
    setAdjust(NO_ADJUST);
    setCameraOpen(false);
    setStatus("empty");
  };

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
    const photoUrl = photo?.url ?? model?.image;
    if (!photoUrl || !selected || sharing) return;
    setSharing(true);
    try {
      const { renderCard, shareOrSave } = await import("./shareCard");
      const name = locale === "es" ? selected.product.nameEs : selected.product.nameEn;
      const blob = await renderCard({
        photoUrl,
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
  const stagePhoto = photo?.url ?? model?.image ?? null;
  const modelTee = model ? catalog.find((p) => p.id === model.teeId) : undefined;
  const setField = (field: keyof FitAdjust, value: number) => setAdjust((prev) => clampAdjust({ ...prev, [field]: value }, anchor));

  return (
    // Bottom padding keeps the last content clear of the fixed add-to-bag bar on phones
    <div className="pb-24 lg:pb-0">
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          {/* Square stage, never taller than the window on desktop */}
          <div className="mx-auto w-full lg:max-w-[min(100%,calc(100svh-9rem))]">
            {selected && (
              <TryOnStage
                photoUrl={stagePhoto}
                overlay={selected.overlay}
                label={
                  photo
                    ? t("stageLabel", { cap: capName })
                    : model
                      ? t("modelLabel", { cap: capName, name: model.name })
                      : t("silhouetteLabel", { cap: capName })
                }
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

          </div>

          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-zinc-600 dark:text-zinc-400">
            {busy ? "" : status === "empty" && model && modelTee ? (
              <>
                {t("modelWearing", { name: model.name })}{" "}
                <Link href={`/products/${modelTee.id}`} className="font-medium text-zinc-950 underline underline-offset-2 dark:text-white">
                  {(locale === "es" ? modelTee.nameEs : modelTee.nameEn).replace(/^Good Luck /, "")}
                </Link>
              </>
            ) : (
              t(status === "empty" ? "emptyHint" : status)
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <PhotoButton onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />} primary={!photo} {...reach}>
              {photo ? t("changePhoto") : t("upload")}
            </PhotoButton>
            <PhotoButton onClick={() => setCameraOpen(true)} icon={<Camera className="h-4 w-4" />} disabled={cameraOpen} {...reach}>
              {t("camera")}
            </PhotoButton>
            <PhotoButton onClick={() => setFineTune((v) => !v)} icon={<SlidersHorizontal className="h-4 w-4" />} pressed={fineTune}>
              {t("fineTune")}
            </PhotoButton>
            {adjusted && (
              <PhotoButton onClick={() => setAdjust(NO_ADJUST)} icon={<RotateCcw className="h-4 w-4" />}>
                {t("reset")}
              </PhotoButton>
            )}
          </div>

          {fineTune && (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-black/[0.08] p-4 dark:border-white/[0.1]">
              <FineTuneSlider label={t("size")} value={adjust.scale} min={0.6} max={1.6} step={0.01} display={`${Math.round(adjust.scale * 100)}%`} onChange={(v) => setField("scale", v)} />
              <FineTuneSlider label={t("tilt")} value={adjust.rotation} min={-35} max={35} step={1} display={`${Math.round(adjust.rotation)}°`} onChange={(v) => setField("rotation", v)} />
              <FineTuneSlider label={t("moveX")} value={adjust.dx} min={-0.3} max={0.3} step={0.005} display={`${Math.round(adjust.dx * 100)}`} onChange={(v) => setField("dx", v)} />
              <FineTuneSlider label={t("moveY")} value={adjust.dy} min={-0.3} max={0.3} step={0.005} display={`${Math.round(adjust.dy * 100)}`} onChange={(v) => setField("dy", v)} />
            </div>
          )}

          {TRY_ON_MODELS.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("modelsLabel")}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("modelsLabel")}>
                {TRY_ON_MODELS.map((m) => {
                  const checked = !photo && m.id === modelId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={m.name}
                      onClick={() => chooseModel(m)}
                      className={`relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-moya-red dark:ring-offset-zinc-950 ${
                        checked ? "ring-zinc-950 dark:ring-white" : "ring-transparent hover:ring-zinc-300 dark:hover:ring-white/30"
                      }`}
                    >
                      <Image src={m.image} alt="" fill sizes="48px" className="object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/[0.08] dark:bg-zinc-950/90 sm:px-6 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
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
              {stagePhoto && (
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

/** Starting placement for a model: from its stored face points, else the default */
function modelAnchor(model: TryOnModel | undefined): CapAnchor {
  return model?.face ? anchorFromFace(model.face) : DEFAULT_ANCHOR;
}

function FineTuneSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm text-zinc-700 dark:text-zinc-300">
        {label}
        <span className="tabular-nums text-zinc-500">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-moya-red"
      />
    </label>
  );
}

function PhotoButton({
  onClick,
  icon,
  children,
  primary = false,
  disabled = false,
  pressed,
  ...rest
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  onPointerEnter?: () => void;
  onFocus?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      {...rest}
      className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
        primary
          ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
          : pressed
            ? "border border-zinc-950 bg-zinc-100 text-zinc-950 dark:border-white dark:bg-white/10 dark:text-white"
            : "border border-zinc-300 text-zinc-800 hover:border-zinc-900 dark:border-white/15 dark:text-zinc-200 dark:hover:border-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
