"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FieldError } from "@convex/catalog/rules";
import { colorInputValue } from "@/lib/admin/teeOptions";

/** Small form primitives shared by the product editor sections. */

export const inputClass =
  "w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red disabled:opacity-60";

export const labelClass = "font-medium text-zinc-700 dark:text-zinc-300 block mb-1";

export const sectionClass = "pt-3 border-t border-zinc-100 dark:border-white/[0.06] space-y-3";

export const sectionTitleClass = "text-xs font-semibold text-zinc-900 dark:text-white";

export function FieldErrorText({ error }: { error?: FieldError }) {
  const t = useTranslations("admin.products.errors");
  if (!error) return null;
  return <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{t(error.code)}</p>;
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: FieldError;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {children}
      </label>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
      <FieldErrorText error={error} />
    </div>
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  type?: "text" | "number";
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1 ${mono ? "font-mono" : ""}`}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
}) {
  return (
    <Field label={label} error={error}>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`} />
    </Field>
  );
}

export function HexField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
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
      <FieldErrorText error={error} />
    </div>
  );
}
