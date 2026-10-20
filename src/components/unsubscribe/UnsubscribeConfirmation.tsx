"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { CheckCircle2, Loader2, MailX, AlertCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { api } from "@convex/_generated/api";

export type UnsubscribeCopy = Record<
  | "working"
  | "doneTitle"
  | "doneBody"
  | "alreadyTitle"
  | "alreadyBody"
  | "invalidTitle"
  | "invalidBody"
  | "errorTitle"
  | "errorBody"
  | "retry"
  | "backToShop",
  string
>;

type Status = "working" | "unsubscribed" | "already_unsubscribed" | "not_found" | "error";

/**
 * Opts the email's reader out as soon as the page opens (one click from the email), then
 * confirms. The mutation is idempotent, so a reload or a second tab is harmless.
 */
export function UnsubscribeConfirmation({ token, copy }: { token: string; copy: UnsubscribeCopy }) {
  const unsubscribe = useMutation(api.notifications.launchAlerts.unsubscribe);
  const [status, setStatus] = useState<Status>(token ? "working" : "not_found");
  const started = useRef(false);

  const send = useCallback(() => {
    unsubscribe({ token })
      .then((result) => setStatus(result.status))
      .catch(() => setStatus("error"));
  }, [token, unsubscribe]);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    send();
  }, [token, send]);

  const retry = () => {
    setStatus("working");
    send();
  };

  const view = {
    working: { icon: <Loader2 className="w-9 h-9 animate-spin text-zinc-400" />, title: copy.working, body: null },
    unsubscribed: { icon: <CheckCircle2 className="w-9 h-9 text-emerald-500" />, title: copy.doneTitle, body: copy.doneBody },
    already_unsubscribed: { icon: <CheckCircle2 className="w-9 h-9 text-emerald-500" />, title: copy.alreadyTitle, body: copy.alreadyBody },
    not_found: { icon: <MailX className="w-9 h-9 text-zinc-400" />, title: copy.invalidTitle, body: copy.invalidBody },
    error: { icon: <AlertCircle className="w-9 h-9 text-moya-red" />, title: copy.errorTitle, body: copy.errorBody },
  }[status];

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center" aria-live="polite">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl glass-dark border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center mb-6">
        {view.icon}
      </div>
      <h1 className="text-3xl sm:text-4xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">{view.title}</h1>
      {view.body && <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-md mt-3">{view.body}</p>}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        {status === "error" && (
          <button
            type="button"
            onClick={retry}
            className="px-5 py-2.5 rounded-xl bg-moya-red text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {copy.retry}
          </button>
        )}
        {status !== "working" && (
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.12] text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:border-moya-red transition-colors"
          >
            {copy.backToShop}
          </Link>
        )}
      </div>
    </div>
  );
}
