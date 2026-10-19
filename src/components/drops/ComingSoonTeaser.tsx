"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { Bell, CheckCircle2, Loader2, Mail, MessageSquare } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Link } from "@/i18n/routing";
import { useCategoryLaunches } from "@/hooks/useCategoryLaunches";
import { useSafeUser } from "@/lib/useSafeUser";
import { timeRemaining } from "@/lib/countdown";
import { SHOP_TO_CATEGORY, teaserHeadline, teaserShopCategories } from "@/lib/launch";
import type { ShopCategory } from "@/lib/shopRoutes";

type Scope = ShopCategory | "all";

/**
 * Coming Soon Teaser (ADR 0022): shown in place of a category's products, or of the whole
 * Shop when nothing is Live. Headline, optional countdown, and the waitlist sign-up.
 */
export function ComingSoonTeaser({ scope }: { scope: Scope }) {
  const t = useTranslations("launch");
  const locale = useLocale() === "es" ? "es" : "en";
  const launches = useCategoryLaunches();

  // Store-wide: every Coming Soon category; the earliest launch date drives the countdown.
  const categories = scope === "all" ? teaserShopCategories(launches) : [scope];
  const launchAt = categories
    .map((c) => launches[SHOP_TO_CATEGORY[c]].launchAt)
    .filter((at): at is number => at !== undefined)
    .sort((a, b) => a - b)[0];
  const headline =
    scope === "all" ? t("headline.all") : teaserHeadline(launches[SHOP_TO_CATEGORY[scope]], locale, t(`headline.${scope}`));

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-zinc-950 px-5 py-14 text-white sm:px-10 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-moya-red/25 blur-3xl" />
      <div className="relative mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          <Bell className="h-3.5 w-3.5" />
          {t("eyebrow")}
        </p>
        <h2 className="mt-5 font-poster text-[clamp(2.75rem,11vw,6.5rem)] uppercase leading-[0.88] tracking-tight">{headline}</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/75">{scope === "all" ? t("bodyAll") : t("body")}</p>
        {launchAt !== undefined && <Countdown target={launchAt} />}
        {categories.length > 0 && <LaunchSignupForm categories={categories} />}
      </div>
    </section>
  );
}

function Countdown({ target }: { target: number }) {
  const t = useTranslations("launch");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  // Rendered only on the client: a static page must not freeze a countdown at build time.
  if (now === null) return <div className="mt-8 h-[76px]" aria-hidden />;

  const left = timeRemaining(target, now);
  if (left.isLive) return <p className="mt-8 font-display text-lg font-semibold text-moya-red">{t("droppingNow")}</p>;

  const units = [
    { value: left.days, label: t("days") },
    { value: left.hours, label: t("hours") },
    { value: left.minutes, label: t("minutes") },
    { value: left.seconds, label: t("seconds") },
  ];
  return (
    <div className="mt-8" role="timer" aria-label={t("countdownLabel")}>
      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t("countdownLabel")}</p>
      <div className="mx-auto grid max-w-sm grid-cols-4 gap-2">
        {units.map((u) => (
          <div key={u.label} className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5">
            <p className="font-poster text-3xl tabular-nums leading-none sm:text-4xl">{String(u.value).padStart(2, "0")}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-white/55">{u.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LaunchSignupForm({ categories }: { categories: ShopCategory[] }) {
  const t = useTranslations("launch");
  const locale = useLocale() === "es" ? "es" : "en";
  const { user } = useSafeUser();
  const subscribe = useMutation(api.notifications.launchAlerts.subscribeToCategoryLaunch);

  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "already">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email && channel === "email") setContact((c) => c || email);
    if (user?.fullName) setName((n) => n || user.fullName || "");
  }, [user, channel]);

  if (state === "done" || state === "already") {
    return (
      <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold" role="status">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        {state === "done" ? t("subscribed") : t("alreadySubscribed")}
      </p>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) {
      setError(t("required"));
      return;
    }
    setError(null);
    setState("sending");
    try {
      const results = await Promise.all(
        categories.map((c) =>
          subscribe({
            category: SHOP_TO_CATEGORY[c],
            contact,
            channel,
            name: name.trim() || undefined,
            clerkUserId: user?.id,
            locale,
          })
        )
      );
      setState(results.every((r) => r.alreadySubscribed) ? "already" : "done");
    } catch {
      setError(t("failed"));
      setState("idle");
    }
  };

  const tab = (value: "email" | "whatsapp", label: string, Icon: typeof Mail) => (
    <button
      type="button"
      role="radio"
      aria-checked={channel === value}
      onClick={() => {
        setChannel(value);
        setContact("");
      }}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-display text-sm font-semibold transition-colors ${
        channel === value ? "bg-white text-zinc-950" : "text-white/70 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-md space-y-3 text-left" noValidate>
      <div role="radiogroup" aria-label={t("contactLabel")} className="mx-auto flex w-fit gap-1 rounded-full border border-white/10 p-1">
        {tab("email", t("channelEmail"), Mail)}
        {tab("whatsapp", t("channelWhatsapp"), MessageSquare)}
      </div>
      <label className="block">
        <span className="sr-only">{t("contactLabel")}</span>
        <input
          type={channel === "email" ? "email" : "tel"}
          inputMode={channel === "email" ? "email" : "tel"}
          autoComplete={channel === "email" ? "email" : "tel"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={channel === "email" ? t("emailPlaceholder") : t("whatsappPlaceholder")}
          className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-5 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-moya-red"
        />
      </label>
      <label className="block">
        <span className="sr-only">{t("namePlaceholder")}</span>
        <input
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-5 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-moya-red"
        />
      </label>
      {error && (
        <p className="text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-moya-red font-display text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        {t("submit")}
      </button>
    </form>
  );
}

/** Grid card standing in for a Coming Soon category on the all-products Shop. */
export function ComingSoonCard({ category }: { category: ShopCategory }) {
  const t = useTranslations("launch");
  const tNav = useTranslations("nav");
  return (
    <Link
      href={`/products?category=${category}`}
      className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[18px] bg-zinc-950 p-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red sm:p-5"
    >
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-moya-red/30 blur-3xl" />
      <p className="relative font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">{t("eyebrow")}</p>
      <p className="relative mt-1 font-poster text-[clamp(2.25rem,8vw,3.5rem)] uppercase leading-[0.85]">{tNav(category)}</p>
      <span className="relative mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-display text-xs font-semibold text-zinc-950">
        <Bell className="h-3.5 w-3.5" />
        {t("cardCta")}
      </span>
    </Link>
  );
}
