/** Drop subscribers: the table's filter and the CSV export, as pure functions (plan 0009 D22). */

export type SubscriberInput = {
  _id: string;
  variantId: string;
  contact: string;
  channel: "whatsapp" | "email";
  name?: string;
  locale: "en" | "es";
  createdAt: number;
  variantNameEn: string;
  variantNameEs: string;
};

export type SubscriberFilters = { q: string; variantId: string | "all" };

/** `q` matches contact, name and either Product name, case-insensitively. */
export function filterSubscribers(subs: SubscriberInput[], f: SubscriberFilters): SubscriberInput[] {
  const q = f.q.trim().toLowerCase();
  return subs.filter((s) => {
    if (f.variantId !== "all" && s.variantId !== f.variantId) return false;
    if (q === "") return true;
    return [s.contact, s.name ?? "", s.variantNameEn, s.variantNameEs].some((field) => field.toLowerCase().includes(q));
  });
}

export const CSV_HEADERS = ["Contact", "Channel", "Name", "Product", "Slug", "Signed up", "Locale"] as const;

export function toCsvRows(subs: SubscriberInput[], locale: "en" | "es"): string[][] {
  return subs.map((s) => [
    s.contact,
    s.channel,
    s.name ?? "",
    locale === "es" ? s.variantNameEs : s.variantNameEn,
    s.variantId,
    new Date(s.createdAt).toISOString(),
    s.locale,
  ]);
}

/** RFC 4180: a field holding a comma, a quote or a line break is quoted, with quotes doubled. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A BOM first so Excel and Numbers read accents; CRLF line ends. */
export function csvText(rows: string[][]): string {
  const lines = [CSV_HEADERS.map(csvField), ...rows.map((r) => r.map(csvField))];
  return "﻿" + lines.map((line) => line.join(",")).join("\r\n");
}

export function csvFilename(now: number): string {
  return `good-luck-drop-subscribers-${new Date(now).toISOString().slice(0, 10)}.csv`;
}
