"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  ArrowRight,
  Shield,
  Search,
  ExternalLink,
  Lock,
} from "lucide-react";

export default function AccountOrdersPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { user, isLoaded, isSignedIn } = useSafeUser();

  const [lookupNumber, setLookupNumber] = useState("");
  const [searchedId, setSearchedId] = useState("");

  // Orders for authenticated Clerk user
  const userOrders = useQuery(
    api.orders.getOrdersByClerkId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  // Guest order lookup
  const guestOrder = useQuery(
    api.orders.getOrderBySessionOrNumber,
    searchedId ? { identifier: searchedId } : "skip"
  );

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookupNumber.trim()) {
      setSearchedId(lookupNumber.trim());
    }
  };

  const ordersToDisplay = isSignedIn && userOrders ? userOrders : guestOrder ? [guestOrder] : [];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-moya-red" />
            <span className="text-xs font-mono uppercase tracking-widest text-moya-red font-bold">
              0880 COLLECTOR PORTAL
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {t("subtitle")}
          </p>
        </div>

        {/* User Identity / Sign In */}
        <div className="flex items-center gap-3">
          {isSignedIn && user ? (
            <div className="flex items-center gap-2.5 p-2 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06]">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-9 h-9 rounded-xl object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-moya-red/20 text-moya-red flex items-center justify-center font-bold text-sm">
                  {user.firstName?.[0] || "U"}
                </div>
              )}
              <div className="text-left pr-2">
                <p className="text-xs font-display font-bold text-zinc-900 dark:text-white">
                  {user.fullName || user.primaryEmailAddress?.emailAddress}
                </p>
                <p className="text-[10px] font-mono text-zinc-500">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SafeSignInButton mode="modal">
                <button className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-display font-bold transition-all shadow">
                  {t("signInBtn")}
                </button>
              </SafeSignInButton>
            </div>
          )}
        </div>
      </div>

      {/* ── Guest Order Lookup Bar ── */}
      <div className="my-6 p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={lookupNumber}
              onChange={(e) => setLookupNumber(e.target.value)}
              placeholder="Search by Order # (e.g. MC-XXXXX) or Stripe Session ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-moya-red/40"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-colors shrink-0"
          >
            Find Order
          </button>
        </form>
      </div>

      {/* ── Orders Listing ── */}
      <div className="space-y-4">
        {ordersToDisplay.length > 0 ? (
          ordersToDisplay.map((ord: any) => (
            <div
              key={ord._id}
              className="p-5 sm:p-6 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-4 shadow-lg hover:shadow-xl transition-shadow"
            >
              {/* Order Meta Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                    Order #{ord.orderNumber}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-zinc-500">
                    {new Date(ord.createdAt).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {ord.trackingNumber && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold">
                      {ord.trackingNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{ord.status === "paid" ? t("statusPaid") : ord.status}</span>
                  </span>
                  <span className="font-mono font-bold text-base text-zinc-900 dark:text-white">
                    ${ord.total}.00 {ord.currency}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ord.items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl glass-dark border border-black/[0.04] dark:border-white/[0.04] flex items-center gap-3"
                  >
                    <div className="relative w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 p-1 shrink-0">
                      <Image src={item.image} alt={item.name} fill className="object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-xs text-zinc-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500">
                        Qty: {item.quantity} • ${item.price}.00
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shipping Address Summary if present */}
              {ord.shippingAddress && (
                <div className="text-xs text-zinc-500 pt-2 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-moya-green shrink-0" />
                  <span className="truncate">
                    Shipping to: {ord.customerName} — {ord.shippingAddress.line1}, {ord.shippingAddress.city},{" "}
                    {ord.shippingAddress.state} {ord.shippingAddress.postalCode}, {ord.shippingAddress.country}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06] text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-400 mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white mb-1">
              {t("noOrders")}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-5">
              {!isSignedIn ? t("signInPrompt") : "Browse the 16 Good Luck drops to secure your next piece."}
            </p>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all shadow-md"
            >
              {t("exploreCta")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
