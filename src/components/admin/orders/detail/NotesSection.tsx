"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, StickyNote } from "lucide-react";
import { Section, inputClass, primaryBtn } from "./Section";

/** Internal notes; ⌘S saves while the textarea has changes. */
export function NotesSection({ notes, busy, onSave, registerSubmit }: {
  notes: string;
  busy: boolean;
  onSave: (text: string) => Promise<boolean>;
  registerSubmit: (submit: (() => void) | null) => void;
}) {
  const t = useTranslations("admin.orderDetail.notes");
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  const dirty = draft.trim() !== notes.trim();
  useEffect(() => {
    registerSubmit(dirty ? () => void onSave(draft) : null);
    return () => registerSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, draft]);
  return (
    <Section title={t("title")} icon={<StickyNote className="w-4 h-4 text-moya-red" />}>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={t("placeholder")} className={`${inputClass} resize-y`} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-zinc-500">{t("hint")}</span>
        <button type="button" onClick={() => void onSave(draft)} disabled={busy || !dirty} className={primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("save")}</button>
      </div>
    </Section>
  );
}
