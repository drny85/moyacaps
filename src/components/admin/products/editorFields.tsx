"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FieldError } from "@convex/catalog/rules";
import { colorInputValue } from "@/lib/admin/teeOptions";

/** Small form primitives shared by the product editor sections. */

export const inputClass =
  "w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red disabled:opacity-60";

export const labelClass = "font-medium text-zinc-700 dark:text-zinc-300 block mb-1";

export const sectionClass =
  "p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14] shadow-xs space-y-3 text-xs";

export const sectionTitleClass = "text-sm font-display font-bold text-zinc-900 dark:text-white";

export function FieldErrorText({ error }: { error?: FieldError }) {
  const t = useTranslations("admin.products.errors");
  if (!error) return null;
  return (
    <p data-field-error className="mt-1 text-[11px] text-red-600 dark:text-red-400">
      {t(error.code)}
    </p>
  );
}

/** Marks a field Photo Autofill filled, until its value changes. */
export function AiPill() {
  const t = useTranslations("admin.products.autofill");
  return (
    <span
      title={t("pillLabel")}
      aria-label={t("pillLabel")}
      className="ml-1.5 inline-flex items-center px-1.5 py-px rounded-full text-[9px] font-mono font-bold tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 align-middle"
    >
      {t("pill")}
    </span>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  action,
  ai,
  children,
}: {
  label: string;
  error?: FieldError;
  hint?: string;
  /** Marks the label; the validators decide what is actually required. */
  required?: boolean;
  /** A small control on the label row, e.g. "Copy from English". */
  action?: React.ReactNode;
  /** Shows the Photo Autofill marker. */
  ai?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        <span className="flex items-center justify-between gap-2">
          <span>
            {label}
            {required && <span className="text-moya-red ml-0.5" aria-hidden>*</span>}
            {ai && <AiPill />}
          </span>
          {action}
        </span>
        {children}
      </label>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
      <FieldErrorText error={error} />
    </div>
  );
}

/** "Copy from English" next to a Spanish field: one tap when the copy is the same in both languages. */
export function CopyFromAction({ source, onCopy }: { source: string; onCopy: (value: string) => void }) {
  const t = useTranslations("admin.products.form");
  return (
    <button
      type="button"
      onClick={() => onCopy(source)}
      disabled={source.trim() === ""}
      className="text-[10px] font-semibold text-moya-red hover:underline disabled:opacity-40 disabled:no-underline"
    >
      {t("copyFromEn")}
    </button>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={`block text-right text-[10px] font-mono mt-0.5 ${over ? "text-red-600 dark:text-red-400" : "text-zinc-400"}`} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  disabled,
  mono,
  required,
  maxLength,
  action,
  ai,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  required?: boolean;
  /** Shows a counter; the server limit stays the source of truth. */
  maxLength?: number;
  action?: React.ReactNode;
  type?: "text" | "number";
  inputMode?: "decimal" | "numeric";
  ai?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} action={action} ai={ai}>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1 ${mono ? "font-mono" : ""}`}
      />
      {maxLength !== undefined && <Counter value={value} max={maxLength} />}
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  maxLength,
  action,
  ai,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  action?: React.ReactNode;
  ai?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} action={action} ai={ai}>
      <textarea rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`} />
      {maxLength !== undefined && <Counter value={value} max={maxLength} />}
    </Field>
  );
}

export function HexField({
  label,
  value,
  onChange,
  error,
  hint,
  ai,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
  hint?: string;
  ai?: boolean;
}) {
  return (
    <div>
      <span className={labelClass}>
        {label}
        {ai && <AiPill />}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={colorInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
        />
        <input
          type="text"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 py-1.5 px-2 rounded-lg bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 font-mono text-zinc-900 dark:text-white uppercase"
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
      <FieldErrorText error={error} />
    </div>
  );
}
