"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { checkIsAdmin } from "@/lib/adminAuth";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Package,
  CheckCircle2,
  Truck,
  ArrowRight,
  Shield,
  Edit3,
  XCircle,
  MessageCircle,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function AccountOrdersPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { user, isLoaded, isSignedIn } = useSafeUser();

  // Convex mutations & actions
  const updateAddressMutation = useMutation(api.orders.updateShippingAddress);
  const cancelAndRefund = useAction(api.stripe.cancelAndRefundOrder);

  // Orders for authenticated Clerk user
  const userOrders = useQuery(
    api.orders.getOrdersByClerkId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const ordersToDisplay = isSignedIn && userOrders ? userOrders : [];

  // ── Address Editing State ──
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [addressForm, setAddressForm] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    customerPhone: "",
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // ── Cancellation State ──
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("Ordered wrong colorway");
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  // ── Feedback Toast ──
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleOpenEditAddress = (ord: any) => {
    setEditingOrder(ord);
    setAddressForm({
      line1: ord.shippingAddress?.line1 || "",
      line2: ord.shippingAddress?.line2 || "",
      city: ord.shippingAddress?.city || "",
      state: ord.shippingAddress?.state || "",
      postalCode: ord.shippingAddress?.postalCode || "",
      customerPhone: ord.customerPhone || "",
    });
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !user?.id) return;

    try {
      setIsSavingAddress(true);
      await updateAddressMutation({
        orderId: editingOrder._id,
        clerkUserId: user.id,
        shippingAddress: {
          line1: addressForm.line1,
          line2: addressForm.line2 || undefined,
          city: addressForm.city,
          state: addressForm.state,
          postalCode: addressForm.postalCode,
          country: editingOrder.shippingAddress?.country || "US",
        },
        customerPhone: addressForm.customerPhone || undefined,
      });

      triggerToast(t("addressUpdated"));
      setEditingOrder(null);
    } catch (err: any) {
      alert(err.message || "Failed to update address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingOrder || !user?.id) return;

    try {
      setIsProcessingCancel(true);
      const data = await cancelAndRefund({
        orderId: cancellingOrder._id,
        clerkUserId: user.id,
        reason: cancelReason,
      });

      triggerToast(data.message || "Order cancelled and refund initiated.");
      setCancellingOrder(null);
    } catch (err: any) {
      alert(err.message || "Failed to cancel order");
    } finally {
      setIsProcessingCancel(false);
    }
  };

  const handleWhatsAppConcierge = (orderNumber: string, actionType: "return" | "tracking" | "support") => {
    const text = encodeURIComponent(
      locale === "es"
        ? `¡Hola Moya Caps Concierge! Necesito asistencia con mi orden #${orderNumber} (${actionType === "return" ? "Cambio/Devolución" : "Rastreo/Envío"}).`
        : `Hi Moya Caps Concierge! I need assistance with my Order #${orderNumber} (${actionType === "return" ? "Exchange/Return" : "Tracking/Delivery"}).`
    );
    window.open(`https://wa.me/5215500000000?text=${text}`, "_blank");
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
      {isSignedIn && checkIsAdmin(user) && (
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
            href="/admin/analytics"
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
              Verified Moya Caps 0880 Drop Ownership
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
          ordersToDisplay.map((ord: any) => {
            const isCancellable = ord.status === "paid" || ord.status === "pending";
            const isShipped = ord.status === "shipped" || ord.status === "dispatched";
            const isCancelled = ord.status === "cancelled";

            return (
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
                    {/* Status Pill */}
                    {isCancelled ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t("statusCancelled")}</span>
                      </span>
                    ) : isShipped ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                        <Truck className="w-3.5 h-3.5" />
                        <span>{t("statusDispatched")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t("statusPaid")}</span>
                      </span>
                    )}

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

                {/* Shipping Destination Summary */}
                {ord.shippingAddress && (
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2 truncate">
                      <Truck className="w-4 h-4 text-moya-green shrink-0" />
                      <span className="truncate">
                        <strong className="text-zinc-900 dark:text-white">{ord.customerName}</strong> —{" "}
                        {ord.shippingAddress.line1}
                        {ord.shippingAddress.line2 ? `, ${ord.shippingAddress.line2}` : ""},{" "}
                        {ord.shippingAddress.city}, {ord.shippingAddress.state} {ord.shippingAddress.postalCode} (
                        {ord.shippingAddress.country})
                        {ord.customerPhone ? ` • ${ord.customerPhone}` : ""}
                      </span>
                    </div>

                    {/* Pre-Dispatch: Edit Address Button */}
                    {isCancellable && (
                      <button
                        onClick={() => handleOpenEditAddress(ord)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.06] transition-colors shrink-0 self-start sm:self-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-moya-red" />
                        <span>{t("editAddress")}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Customer Management Actions Bar */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-mono text-zinc-500">
                    {isCancellable
                      ? "Eligible for address modification & instant refund prior to courier handover."
                      : isShipped
                      ? "In transit with courier. For delivery inquiries or returns, reach Concierge."
                      : "Order finalized."}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pre-Dispatch: Cancel Order Button */}
                    {isCancellable && (
                      <button
                        onClick={() => setCancellingOrder(ord)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-display font-bold transition-colors border border-rose-500/20"
                      >
                        {t("cancelOrder")}
                      </button>
                    )}

                    {/* Concierge Support WhatsApp */}
                    <button
                      onClick={() => handleWhatsAppConcierge(ord.orderNumber, isShipped ? "return" : "support")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-moya-green-deep/10 hover:bg-moya-green-deep/20 text-emerald-600 dark:text-emerald-400 text-xs font-display font-bold transition-colors border border-emerald-500/20"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t("conciergeHelp")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
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
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative">
            <button
              onClick={() => setEditingOrder(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Edit3 className="w-4 h-4 text-moya-red" />
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("editAddress")}
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Updating delivery address for Order #{editingOrder.orderNumber}
            </p>

            <form onSubmit={handleSaveAddress} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-500 mb-1">Street Address</label>
                <input
                  type="text"
                  required
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  placeholder="Street & house number"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-500 mb-1">Apartment, Suite, Unit (Optional)</label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  placeholder="Apt 4B"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1">State / Province</label>
                  <input
                    type="text"
                    required
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1">Postal / ZIP Code</label>
                  <input
                    type="text"
                    required
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1">Phone (for Courier)</label>
                  <input
                    type="tel"
                    value={addressForm.customerPhone}
                    onChange={(e) => setAddressForm({ ...addressForm, customerPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="px-5 py-2 rounded-xl bg-moya-red hover:bg-rose-500 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-lg shadow-moya-red/30 disabled:opacity-50"
                >
                  {isSavingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingAddress ? t("saving") : t("saveAddress")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cancellation & Refund ── */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
              {t("cancelConfirmTitle")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {t("cancelConfirmDesc")}
            </p>

            <div className="my-4 p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-zinc-500">Order:</span>
                <span className="font-bold text-zinc-900 dark:text-white">#{cancellingOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between font-mono mt-1">
                <span className="text-zinc-500">Refund Amount:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${cancellingOrder.total}.00 {cancellingOrder.currency}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-mono text-zinc-500 mb-1">
                {t("cancelReasonLabel")}
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
              >
                <option value="Ordered wrong colorway">{t("cancelReason1")}</option>
                <option value="Accidental duplicate order">{t("cancelReason2")}</option>
                <option value="Need to change delivery details">{t("cancelReason3")}</option>
                <option value="Changed my mind">{t("cancelReason4")}</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                disabled={isProcessingCancel}
                className="px-4 py-2 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-700 dark:text-zinc-300"
              >
                {t("keepOrderBtn")}
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isProcessingCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isProcessingCancel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{isProcessingCancel ? "Processing..." : t("confirmCancelBtn")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
