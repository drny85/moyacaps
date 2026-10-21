"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { photoAutofill } from "@/app/actions/photoAutofill";
import { AUTOFILL_MAX_PHOTOS, checkPhotos, downscalePhoto } from "@/lib/admin/photoAutofill/photos";
import type { AutofillCatalogContext } from "@/lib/admin/photoAutofill/context";
import type { AutofillOutcome } from "@/lib/admin/photoAutofill/merge";
import type { AutofillProposal } from "@/lib/admin/photoAutofill/schema";
import { sectionClass, sectionTitleClass } from "./editorFields";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; key: "forbidden" | "badPhotos" | "modelFailed" | "decode" }
  | { kind: "done" };

const ERROR_KEYS = { forbidden: "forbidden", bad_photos: "badPhotos", model_failed: "modelFailed" } as const;

/**
 * Photo Autofill on the new product page (CONTEXT.md, ADR 0027): up to four photos,
 * shrunk in the browser, read by the server action; the empty form fields are filled.
 */
export function PhotoAutofillPanel({
  onProposal,
  outcome,
}: {
  /** Merges the proposal into the live form (editor reducer), so edits made meanwhile survive. */
  onProposal: (proposal: AutofillProposal, ctx: AutofillCatalogContext) => void;
  /** The editor's last autofill outcome, shown once this panel's run is done. */
  outcome: AutofillOutcome | null;
}) {
  const t = useTranslations("admin.products.autofill");
  const tProducts = useTranslations("admin.products");
  const locale = useLocale();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const done = status.kind === "done" ? outcome : null;
  // An applied run clears the photos; an unrecognized one keeps them so the Administrator can swap one.
  useEffect(() => {
    if (done?.kind === "applied") setFiles([]);
  }, [done]);

  const check = checkPhotos(files);
  const working = status.kind === "working";

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, AUTOFILL_MAX_PHOTOS + 1));
    setStatus({ kind: "idle" });
  };

  const run = async () => {
    if (!check.ok || working) return;
    setStatus({ kind: "working" });
    let blobs: Blob[];
    try {
      blobs = await Promise.all(files.map(downscalePhoto));
    } catch {
      setStatus({ kind: "error", key: "decode" });
      return;
    }
    const data = new FormData();
    blobs.forEach((b, i) => data.append("photos", b, `photo-${i + 1}.jpg`));
    data.append("locale", locale);
    try {
      const response = await photoAutofill(data);
      if (!response.ok) {
        setStatus({ kind: "error", key: ERROR_KEYS[response.error] });
        return;
      }
      onProposal(response.proposal, response.context);
      setStatus({ kind: "done" });
    } catch {
      setStatus({ kind: "error", key: "modelFailed" });
    }
  };

  return (
    <section className={sectionClass} aria-busy={working}>
      <div>
        <h3 className={`${sectionTitleClass} flex items-center gap-1.5`}>
          <Sparkles className="w-4 h-4 text-violet-500" aria-hidden /> {t("title")}
        </h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{t("hint")}</p>
      </div>

      <label
        className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-zinc-300 dark:border-white/15 text-zinc-500 cursor-pointer hover:border-violet-400 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus className="w-7 h-7" aria-hidden />
        <span className="font-medium">{t("drop")}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={working}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {files.map((file, i) => (
            <li key={previews[i]} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={previews[i]} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label={t("remove")}
                disabled={working}
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && !check.ok && <p className="text-[11px] text-red-600 dark:text-red-400">{t("errors.badPhotos")}</p>}

      <button
        type="button"
        onClick={() => void run()}
        disabled={!check.ok || working}
        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-50"
      >
        {working ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
        {working ? t("working") : t("run")}
      </button>

      <div role="status" aria-live="polite" className="space-y-1 text-[11px]">
        {status.kind === "error" && <p className="text-red-600 dark:text-red-400">{t(`errors.${status.key}`)}</p>}
        {done?.kind === "unrecognized" && (
          <>
            <p className="text-amber-700 dark:text-amber-400">{t("unrecognized")}</p>
            {done.note && <p className="text-zinc-500">{done.note}</p>}
          </>
        )}
        {done?.kind === "applied" && (
          <>
            <p className="text-zinc-700 dark:text-zinc-300">{t("done", { count: Object.keys(done.filled).length })}</p>
            {done.categoryConflict && (
              <p className="text-amber-700 dark:text-amber-400">
                {t("categoryConflict", { category: tProducts(`categories.${done.categoryConflict}`) })}
              </p>
            )}
            {done.note && <p className="text-zinc-500">{done.note}</p>}
          </>
        )}
      </div>
    </section>
  );
}
