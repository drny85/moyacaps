"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Sparkles } from "lucide-react";
import { AdminModal } from "../AdminModal";
import { autofillSteps } from "@/lib/admin/photoAutofill/progress";
import type { AutofillPhase } from "@/lib/admin/photoAutofill/progress";

const TITLE_ID = "photo-autofill-progress-title";
const noop = () => {};

/**
 * Blocks the editor while Photo Autofill runs: the backdrop takes every click, Escape and
 * the admin shortcuts are off (an open dialog owns the keyboard), and Tab cannot reach the
 * form behind, so nothing changes under the result.
 */
export function PhotoAutofillProgress({ phase, previews }: { phase: AutofillPhase; previews: string[] }) {
  const t = useTranslations("admin.products.autofill.progress");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Enter" || e.key === " ") e.preventDefault();
    };
    window.addEventListener("keydown", trap, true);
    return () => window.removeEventListener("keydown", trap, true);
  }, []);

  return (
    <AdminModal isOpen onClose={noop} isProcessing labelledBy={TITLE_ID} maxWidthClass="max-w-sm">
      <div aria-live="polite" aria-busy className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center w-11 h-11 shrink-0">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 motion-safe:animate-glow-pulse" aria-hidden />
            <Sparkles className="relative w-5 h-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={TITLE_ID} className="font-display font-bold text-base text-zinc-900 dark:text-white">
              {t("title")}
            </h2>
            <p className="text-[11px] font-mono text-zinc-500 tabular-nums">{t("elapsed", { seconds })}</p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("body")}</p>

        {previews.length > 0 && (
          <ul className="grid grid-cols-4 gap-2" aria-hidden>
            {previews.map((src) => (
              <li key={src} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/5 ring-1 ring-violet-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <span className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_12px_2px_rgba(167,139,250,0.7)] motion-safe:animate-photo-scan" />
              </li>
            ))}
          </ul>
        )}

        <ol className="space-y-2.5 text-xs">
          {autofillSteps(phase).map(({ key, state }) => (
            <li key={key} className="flex items-center gap-2.5">
              <span
                className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${
                  state === "done"
                    ? "bg-emerald-500 text-white"
                    : state === "active"
                      ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
                      : "bg-zinc-100 dark:bg-white/5"
                }`}
              >
                {state === "done" && <Check className="w-3 h-3" aria-hidden />}
                {state === "active" && <Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden />}
              </span>
              <span className={state === "pending" ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-800 dark:text-zinc-200 font-medium"}>
                {t(`steps.${key}`, { count: previews.length })}
              </span>
            </li>
          ))}
        </ol>

        <p className="text-[11px] text-zinc-500 border-t border-zinc-200 dark:border-white/10 pt-3">{t("keepOpen")}</p>
      </div>
    </AdminModal>
  );
}
