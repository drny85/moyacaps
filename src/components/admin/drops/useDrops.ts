"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import { useMinuteClock } from "@/hooks/useMinuteClock";

export type ScheduleArgs = { variantId: string; isDrop: boolean; dropDate?: number; dropBadgeTextEn?: string; dropBadgeTextEs?: string };

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The Drops page's data and actions. `schedule` throws so DropScheduleDialog can show the failure itself. */
export function useDrops() {
  const t = useTranslations("admin.drops.toast");
  const tCommon = useTranslations("admin.common");
  const clientTime = useMinuteClock();

  const drops = useQuery(api.catalog.drops.getAllDropsAdmin, { clientTime });
  const catalog = useQuery(api.catalog.admin.getAllProductsAdmin, {});
  const subscribers = useQuery(api.catalog.drops.getDropSubscribersList, {});

  const scheduleDrop = useMutation(api.catalog.drops.scheduleDrop);
  const releaseDropNow = useMutation(api.catalog.drops.releaseDropNow);
  const cancelDrop = useMutation(api.catalog.drops.cancelDrop);
  const deleteDrop = useMutation(api.catalog.drops.deleteDrop);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(id);
  }, [success]);

  const run = useCallback(
    async (work: () => Promise<string>) => {
      setBusy(true);
      setError(null);
      try {
        setSuccess(await work());
        return true;
      } catch (err) {
        setError(errorMessage(err, tCommon("actionFailed")));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [tCommon]
  );

  const actions = useMemo(
    () => ({
      /** DropScheduleDialog's onSave: enabled with a date schedules (or reschedules); disabled cancels. */
      schedule: async (args: ScheduleArgs) => {
        setBusy(true);
        try {
          if (args.isDrop && args.dropDate !== undefined) {
            await scheduleDrop({ variantId: args.variantId, dropDate: args.dropDate, dropBadgeTextEn: args.dropBadgeTextEn, dropBadgeTextEs: args.dropBadgeTextEs });
            setSuccess(t("scheduled"));
          } else {
            await cancelDrop({ variantId: args.variantId });
            setSuccess(t("cancelled"));
          }
        } finally {
          setBusy(false);
        }
      },
      release: (variantId: string) =>
        run(async () => {
          await releaseDropNow({ variantId, keepBadge: true });
          return t("released");
        }),
      cancel: (variantId: string) =>
        run(async () => {
          await cancelDrop({ variantId });
          return t("cancelled");
        }),
      remove: (variantId: string, deleteSubscribers: boolean) =>
        run(async () => {
          await deleteDrop({ variantId, deleteSubscribers });
          return t("deleted");
        }),
    }),
    [run, t, scheduleDrop, releaseDropNow, cancelDrop, deleteDrop]
  );

  return { clientTime, drops, catalog, subscribers, busy, error, success, dismissError: () => setError(null), actions };
}
