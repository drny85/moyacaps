"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { getWhatsAppConciergeUrl } from "@/lib/whatsapp";
import { conciergeMessage } from "@/lib/accountOrders";
import { OrderCard } from "@/components/account/orders/OrderCard";
import { EditAddressDialog } from "@/components/account/orders/EditAddressDialog";
import { CancelOrderDialog } from "@/components/account/orders/CancelOrderDialog";
import type { CustomerOrder } from "@/components/account/orders/types";
import { Package, ArrowRight, Shield, Check } from "lucide-react";

/**
 * Stays a client page: the Orders are a live, per-user Convex subscription behind Clerk.
 * Each card and dialog lives in src/components/account/orders.
 */
export default function AccountOrdersPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { user, isSignedIn } = useSafeUser();
  const { isAdmin } = useIsAdmin();

  // Orders for authenticated Clerk user
  const userOrders = useQuery(
    api.orders.functions.getOrdersByClerkId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const ordersToDisplay = isSignedIn && userOrders ? userOrders : [];

  // ── Open dialogs ──
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<CustomerOrder | null>(null);

  // ── Feedback Toast ──
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleWhatsAppConcierge = (orderNumber: string, actionType: "return" | "support") => {
    window.open(getWhatsAppConciergeUrl(locale, conciergeMessage(locale, orderNumber, actionType)), "_blank");
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* ── Toast Feedback ── */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xl flex items-center gap-2.5 border border-white/10 dark:border-black/10 font-display text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* ── Administrator Banner ── */}
      {isSignedIn && isAdmin && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-zinc-900/40 border border-moya-red/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-moya-red text-white flex items-center justify-center shadow-lg shadow-moya-red/30 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-moya-red">
                  Administrator Session Active
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Staff Access
                </span>
              </div>
              <p className="text-sm font-display font-semibold text-zinc-900 dark:text-white mt-0.5">
                You have elevated privileges to fulfill orders, edit catalog stock, and review financial metrics.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-moya-red hover:bg-rose-600 text-white font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-moya-red/30 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <span>Open Admin Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

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

      {/* ── Collector Vault Summary ── */}
      <div className="my-6 p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moya-red/10 border border-moya-red/20 flex items-center justify-center text-moya-red">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-display font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              {ordersToDisplay.length} {ordersToDisplay.length === 1 ? "Piece Secured" : "Pieces Secured"}
            </p>
            <p className="text-[11px] font-mono text-zinc-500">
              Verified Good Luck 0880 Drop Ownership
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.06] transition-colors"
        >
          <span>Catalog</span>
          <ArrowRight className="w-3.5 h-3.5 text-moya-red" />
        </Link>
      </div>

      {/* ── Orders Listing ── */}
      <div className="space-y-6">
        {ordersToDisplay.length > 0 ? (
          ordersToDisplay.map((ord) => (
            <OrderCard
              key={ord._id}
              order={ord}
              onEditAddress={setEditingOrder}
              onCancel={setCancellingOrder}
              onConcierge={handleWhatsAppConcierge}
            />
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

      {/* ── Modal: Edit Shipping Address ── */}
      {editingOrder && user?.id && (
        <EditAddressDialog
          order={editingOrder}
          clerkUserId={user.id}
          onClose={() => setEditingOrder(null)}
          onSaved={triggerToast}
        />
      )}

      {/* ── Modal: Cancellation & Refund ── */}
      {cancellingOrder && user?.id && (
        <CancelOrderDialog
          order={cancellingOrder}
          onClose={() => setCancellingOrder(null)}
          onCancelled={triggerToast}
        />
      )}
    </div>
  );
}
