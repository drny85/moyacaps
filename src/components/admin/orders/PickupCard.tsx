"use client";

/**
 * USPS Package Pickup on the Orders desk. Priority Mail and international packages are scheduled
 * through Shippo; Ground Advantage ones go to usps.com or ride along on the same stop
 * (convex/shipping/pickupPlan.ts).
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { CalendarClock, ExternalLink, Loader2, Truck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PICKUP_LOCATIONS, USPS_PICKUP_SITE_URL, nextPickupDate, type PickupLocation } from "@convex/shipping/pickupPlan";
import { USPS_PHONE, localDay, localTimeMs, pickupCardView } from "@/lib/admin/pickupCard";

const inputClass =
  "w-full py-2 px-2.5 text-xs rounded-lg bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red";

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : fallback;
  return fallback;
}

export function PickupCard() {
  const t = useTranslations("admin.orders.pickup");
  const today = useMemo(() => localDay(new Date()), []);
  const desk = useQuery(api.shipping.pickupQueries.pickupDesk, { today });
  const schedule = useAction(api.shipping.pickups.schedulePickup);

  const [pickupDate, setPickupDate] = useState(() => nextPickupDate(new Date()));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [location, setLocation] = useState<PickupLocation>("Front Door");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!desk) return null;
  const view = pickupCardView(desk, pickupDate);
  if (view.hidden) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await schedule({
        today,
        pickupDate,
        requestedStartTime: localTimeMs(pickupDate, start),
        requestedEndTime: localTimeMs(pickupDate, end),
        location,
        ...(instructions.trim() && { instructions: instructions.trim() }),
      });
      setDone(t("scheduled", { count: result.packages, code: result.confirmationCode ?? "—" }));
    } catch (err) {
      if (!(err instanceof ConvexError)) console.error("Pickup scheduling failed", err);
      setError(errorText(err, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <section className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c0c14] space-y-3" aria-labelledby="pickup-title">
      <h2 id="pickup-title" className="font-display font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
        <Truck className="w-4 h-4 text-blue-500" /> {t("title")}
      </h2>

      {desk.upcoming.length > 0 && (
        <ul className="space-y-1.5">
          {desk.upcoming.map((p) => (
            <li key={p._id} className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-zinc-900 dark:text-white">
                <CalendarClock className="w-3.5 h-3.5 text-blue-500" />
                {p.pickupDate} · {time(p.requestedStartTime)}–{time(p.requestedEndTime)}
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300">
                  {p.confirmationCode ?? p.status}
                </span>
                {p.simulated && <span className="text-[10px] uppercase text-amber-600">{t("simulated")}</span>}
              </div>
              <p className="mt-1">
                {t("upcomingDetail", { count: p.packages, location: p.location })} {t("changeHint", { phone: USPS_PHONE })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {view.apiCount > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("apiWaiting", { count: view.apiCount })}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="space-y-1 text-[11px] text-zinc-500 col-span-2 sm:col-span-1">
              {t("date")}
              <input type="date" min={today} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-[11px] text-zinc-500">
              {t("from")}
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-[11px] text-zinc-500">
              {t("until")}
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-[11px] text-zinc-500 col-span-2 sm:col-span-1">
              {t("location")}
              <select value={location} onChange={(e) => setLocation(e.target.value as PickupLocation)} className={inputClass}>
                {PICKUP_LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {location === "Other" && (
            <input
              type="text"
              maxLength={200}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("instructions")}
              aria-label={t("instructions")}
              className={inputClass}
            />
          )}
          {view.dateTaken && <p className="text-xs text-amber-600 dark:text-amber-400">{t("dateTaken")}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!view.canSchedule || busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("schedule", { count: view.apiCount })}
          </button>
        </div>
      )}

      {view.uspsSiteCount > 0 && (
        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5">
          <p>
            {t("uspsSiteWaiting", { count: view.uspsSiteCount })}
            {view.canRideAlong && ` ${t("rideAlong")}`}
          </p>
          <a
            href={USPS_PICKUP_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t("uspsSiteLink")}
          </a>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {done && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{done}</p>}
    </section>
  );
}
