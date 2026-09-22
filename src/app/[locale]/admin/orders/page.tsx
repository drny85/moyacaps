"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { getCarrierTrackingUrl } from "@/lib/tracking";
import { getWhatsAppAdminCustomerUrl } from "@/lib/whatsapp";
import {
  Search,
  Filter,
  CheckCircle2,
  Truck,
  Package,
  MessageCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  MapPin,
  Mail,
  Phone,
  User,
  X,
  Send,
  Edit3,
  Undo2,
  AlertCircle,
  Maximize2,
  Printer,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";

export default function AdminOrdersPage() {
  const t = useTranslations("admin.orders");
  const tStatus = useTranslations("account");
  const locale = useLocale();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Selected order for detail drawer
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // URL query param synchronization
  const searchParams = useSearchParams();
  const orderParam = searchParams.get("order");

  const handleSelectOrder = (order: any | null) => {
    setSelectedOrder(order);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (order) {
        url.searchParams.set("order", order.orderNumber);
      } else {
        url.searchParams.delete("order");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Modals state
  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [carrierInput, setCarrierInput] = useState("USPS");
  const [trackingInput, setTrackingInput] = useState("");
  const [adminNotesInput, setAdminNotesInput] = useState("");

  const [confirmWhatsAppOrder, setConfirmWhatsAppOrder] = useState<any | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);
  const [refundStripeToggle, setRefundStripeToggle] = useState(true);
  const [cancelReasonInput, setCancelReasonInput] = useState("");

  const [deliverModalOrder, setDeliverModalOrder] = useState<any | null>(null);
  const [revertModalOrder, setRevertModalOrder] = useState<any | null>(null);

  const [editAddressOrder, setEditAddressOrder] = useState<any | null>(null);
  const [addressForm, setAddressForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  const [copiedTracking, setCopiedTracking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setFeedbackSuccess(msg);
    setTimeout(() => setFeedbackSuccess(null), 4000);
  };

  // Convex queries, mutations & actions
  const orders = useQuery(api.orders.getAllOrdersAdmin, {
    status: statusFilter,
    paymentMethod: paymentFilter,
    search: searchQuery,
  });

  // Auto-open drawer if ?order= is present in URL
  React.useEffect(() => {
    if (orderParam && orders && orders.length > 0 && !selectedOrder) {
      const cleanTarget = orderParam.trim().toUpperCase().replace(/^#/, "");
      const match = orders.find(
        (o: any) =>
          o.orderNumber.toUpperCase() === cleanTarget ||
          o.orderNumber.toUpperCase() === `GL-${cleanTarget}` ||
          o.orderNumber.toUpperCase() === `MC-${cleanTarget}`
      );
      if (match) {
        setSelectedOrder(match);
      }
    }
  }, [orderParam, orders, selectedOrder]);

  const updateOrderStatus = useMutation(api.orders.updateOrderStatusAdmin);
  const updateOrderFulfillment = useMutation(api.orders.updateOrderFulfillmentAdmin);
  const updateShippingAddressAdmin = useMutation(api.orders.updateShippingAddressAdmin);
  const cancelAndRefundAdmin = useAction(api.stripe.cancelAndRefundOrderAdmin);

  // Attention stats & Resend test alert action
  const attentionStats = useQuery(api.orders.getOrdersAttentionStats);
  const sendTestAlert = useAction(api.emails.sendTestAdminOrderAlert);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);

  const handleSendTestAlert = async () => {
    try {
      setIsSendingTestAlert(true);
      setActionError(null);
      const res = await sendTestAlert({});
      triggerSuccess(`Test order alert dispatched via Resend to ${res.recipient}!`);
    } catch (err: any) {
      console.error("Failed to send test alert:", err);
      setActionError(err?.message || "Failed to dispatch test order alert via Resend.");
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  // Status transitions
  const handleConfirmWhatsAppPayment = async () => {
    if (!confirmWhatsAppOrder) return;
    try {
      setIsProcessing(true);
      await updateOrderStatus({
        orderId: confirmWhatsAppOrder._id,
        newStatus: "paid",
      });
      setConfirmWhatsAppOrder(null);
      if (selectedOrder?._id === confirmWhatsAppOrder._id) {
        setSelectedOrder({ ...selectedOrder, status: "paid" });
      }
      triggerSuccess("WhatsApp offline payment confirmed and stock deducted.");
    } catch (err: any) {
      console.error("Failed to confirm WhatsApp payment", err);
      setActionError(err?.message || "Failed to confirm WhatsApp payment. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispatchOrder = async (notifyWhatsApp = false) => {
    if (!dispatchModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      const carrier = carrierInput.trim() || "USPS";
      const tracking = trackingInput.trim() || undefined;

      await updateOrderStatus({
        orderId: dispatchModalOrder._id,
        newStatus: "dispatched",
        carrier,
        trackingNumber: tracking,
        adminNotes: adminNotesInput.trim() || undefined,
      });

      if (selectedOrder?._id === dispatchModalOrder._id) {
        setSelectedOrder({
          ...selectedOrder,
          status: "dispatched",
          carrier,
          trackingNumber: tracking,
          adminNotes: adminNotesInput,
        });
      }

      if (notifyWhatsApp && dispatchModalOrder.customerPhone) {
        openWhatsAppCustomer({
          ...dispatchModalOrder,
          carrier,
          trackingNumber: tracking,
        });
      }

      setDispatchModalOrder(null);
      triggerSuccess("Order successfully marked as dispatched!");
    } catch (err: any) {
      console.error("Failed to dispatch order", err);
      setActionError(err?.message || "Failed to dispatch order. Please check inputs and retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!deliverModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateOrderStatus({
        orderId: deliverModalOrder._id,
        newStatus: "delivered",
      });
      if (selectedOrder?._id === deliverModalOrder._id) {
        setSelectedOrder({ ...selectedOrder, status: "delivered" });
      }
      setDeliverModalOrder(null);
      triggerSuccess("Shipment delivery successfully confirmed.");
    } catch (err: any) {
      console.error("Failed to mark delivered", err);
      setActionError(err?.message || "Failed to update delivery status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRevert = async () => {
    if (!revertModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateOrderStatus({
        orderId: revertModalOrder._id,
        newStatus: "dispatched",
      });
      if (selectedOrder?._id === revertModalOrder._id) {
        setSelectedOrder({ ...selectedOrder, status: "dispatched" });
      }
      setRevertModalOrder(null);
      triggerSuccess("Order status reverted back to Dispatched.");
    } catch (err: any) {
      console.error("Failed to revert order", err);
      setActionError(err?.message || "Failed to revert order status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenCancelModal = (order: any) => {
    setCancelModalOrder(order);
    setRefundStripeToggle(order.paymentMethod === "stripe" && !!order.stripeSessionId);
    setCancelReasonInput("");
  };

  const handleCancelAndRestock = async () => {
    if (!cancelModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      const res = await cancelAndRefundAdmin({
        orderId: cancelModalOrder._id,
        refundStripe: refundStripeToggle,
        reason: cancelReasonInput.trim() || undefined,
        adminNotes: cancelReasonInput.trim() ? `Cancelled by admin: ${cancelReasonInput.trim()}` : undefined,
      });

      setCancelModalOrder(null);
      if (selectedOrder?._id === cancelModalOrder._id) {
        setSelectedOrder({ ...selectedOrder, status: "cancelled" });
      }
      triggerSuccess(res.message);
    } catch (err: any) {
      console.error("Failed to cancel order", err);
      setActionError(err?.message || "Failed to cancel order.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditAddress = (order: any) => {
    setEditAddressOrder(order);
    setAddressForm({
      customerName: order.customerName || "",
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone || "",
      line1: order.shippingAddress?.line1 || "",
      line2: order.shippingAddress?.line2 || "",
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || "",
      postalCode: order.shippingAddress?.postalCode || "",
      country: order.shippingAddress?.country || "US",
    });
  };

  const handleSaveAddressAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAddressOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateShippingAddressAdmin({
        orderId: editAddressOrder._id,
        customerName: addressForm.customerName.trim() || undefined,
        customerEmail: addressForm.customerEmail.trim() || undefined,
        customerPhone: addressForm.customerPhone.trim() || undefined,
        shippingAddress: {
          line1: addressForm.line1.trim(),
          line2: addressForm.line2.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state.trim(),
          postalCode: addressForm.postalCode.trim(),
          country: addressForm.country.trim() || "US",
        },
      });

      const updatedShipping = {
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim() || "US",
      };

      if (selectedOrder?._id === editAddressOrder._id) {
        setSelectedOrder({
          ...selectedOrder,
          customerName: addressForm.customerName.trim() || selectedOrder.customerName,
          customerEmail: addressForm.customerEmail.trim() || selectedOrder.customerEmail,
          customerPhone: addressForm.customerPhone.trim() || selectedOrder.customerPhone,
          shippingAddress: updatedShipping,
        });
      }

      setEditAddressOrder(null);
      triggerSuccess("Recipient and shipping address successfully updated.");
    } catch (err: any) {
      console.error("Failed to update shipping address", err);
      setActionError(err?.message || "Failed to update address.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openWhatsAppCustomer = (order: any) => {
    const url = getWhatsAppAdminCustomerUrl({
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      locale,
    });
    window.open(url, "_blank");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Paid & Ready
          </span>
        );
      case "dispatched":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Truck className="w-3.5 h-3.5" /> Dispatched
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case "whatsapp_initiated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Pending
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
            <XCircle className="w-3.5 h-3.5" /> Cancelled & Restocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
            Fulfillment & Dispatches
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {t("subtitle")}
          </p>
        </div>

        {/* Actions & Counter */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendTestAlert}
            disabled={isSendingTestAlert}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-zinc-50 dark:hover:bg-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Dispatch a test order alert to verify Resend email delivery"
          >
            {isSendingTestAlert ? (
              <span className="w-3.5 h-3.5 border-2 border-moya-red border-t-transparent rounded-full animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-moya-red" />
            )}
            <span>{isSendingTestAlert ? "Sending..." : "Test Resend Alert"}</span>
          </button>

          <span className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-xs font-mono text-zinc-700 dark:text-zinc-300">
            {orders ? `${orders.length} orders` : "Loading..."}
          </span>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded hover:bg-red-500/20 text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Success Alert */}
      {feedbackSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{feedbackSuccess}</span>
          </div>
          <button
            onClick={() => setFeedbackSuccess(null)}
            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Realtime Attention Warning Banner */}
      {attentionStats && attentionStats.totalActionRequired > 0 && statusFilter !== "needs_attention" && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {attentionStats.totalActionRequired} order(s) require operational attention
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                {attentionStats.unfulfilledPaid} awaiting dispatch
                {attentionStats.pendingWhatsApp > 0 && ` • ${attentionStats.pendingWhatsApp} WhatsApp leads awaiting verification`}
                {attentionStats.overduePaid > 0 && (
                  <span className="text-rose-500 font-bold ml-1">
                    • {attentionStats.overduePaid} overdue (&gt;24h)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter("needs_attention")}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shrink-0 flex items-center gap-1 shadow-xs"
          >
            Filter Action Items →
          </button>
        </div>
      )}

      {/* ── Filters Bar ── */}
      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-900 dark:hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Channel:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="py-2 px-3 text-xs rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red font-medium"
            >
              <option value="all">{t("allPayments")}</option>
              <option value="stripe">Stripe Checkout</option>
              <option value="whatsapp">WhatsApp Concierge</option>
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
          {[
            {
              id: "needs_attention",
              label: "⚠️ Action Required",
              count: attentionStats?.totalActionRequired || 0,
              highlight: true,
            },
            {
              id: "overdue",
              label: "⏳ Overdue (>24h)",
              count: attentionStats?.overduePaid || 0,
              danger: true,
            },
            { id: "all", label: t("allStatuses") },
            { id: "paid", label: "Paid" },
            { id: "dispatched", label: "Dispatched" },
            { id: "delivered", label: "Delivered" },
            { id: "whatsapp_initiated", label: "WhatsApp Leads" },
            { id: "cancelled", label: "Cancelled" },
          ]
            .filter((pill) => {
              if (pill.id === "overdue") return (attentionStats?.overduePaid || 0) > 0;
              return true;
            })
            .map((pill) => {
              const isSelected = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? pill.highlight
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : pill.danger
                          ? "bg-rose-500 text-white font-bold shadow-xs"
                          : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                      : pill.highlight && pill.count > 0
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 font-semibold"
                        : pill.danger && pill.count > 0
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25 font-semibold"
                          : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>{pill.label}</span>
                  {pill.count !== undefined && pill.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        isSelected
                          ? "bg-black/20 text-inherit"
                          : pill.highlight
                            ? "bg-amber-500 text-black"
                            : pill.danger
                              ? "bg-rose-500 text-white"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {pill.count}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-xs">
        {!orders ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-600 dark:text-zinc-400 animate-pulse">
            Loading reactive order telemetry...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-zinc-500 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {t("noOrdersFound")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
              Try adjusting your search keywords or clearing your status filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.02] text-zinc-600 dark:text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Caps Ordered</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {orders.map((order) => {
                  const dateStr = new Date(order.createdAt).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={order._id}
                      onClick={() => handleSelectOrder(order)}
                      className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* Order Number & Date */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-zinc-900 dark:text-white block group-hover:text-moya-red transition-colors">
                          {order.orderNumber}
                        </span>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono block">
                          {dateStr}
                        </span>
                        {order.trackingNumber && (
                          <a
                            href={getCarrierTrackingUrl(order.carrier, order.trackingNumber) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                            title="Open live carrier tracking"
                          >
                            <Truck className="w-2.5 h-2.5" />
                            <span>{order.carrier ? order.carrier.split(" ")[0] : "Track"}: {order.trackingNumber}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-zinc-900 dark:text-white block truncate max-w-[150px]">
                          {order.customerName || "Guest Collector"}
                        </span>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate block max-w-[150px]">
                          {order.customerEmail || order.customerPhone || "No email"}
                        </span>
                      </td>

                      {/* Caps Ordered */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-2 overflow-hidden">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <div
                                key={idx}
                                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-black relative overflow-hidden shrink-0"
                              >
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  className="object-contain p-0.5"
                                />
                              </div>
                            ))}
                          </div>
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono ml-1">
                            {order.items.reduce((s, it) => s + it.quantity, 0)} pcs
                          </span>
                        </div>
                      </td>

                      {/* Channel Badge */}
                      <td className="py-3.5 px-4">
                        {order.paymentMethod === "whatsapp" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            Stripe Card
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        ${order.total} <span className="text-[10px] text-zinc-600 dark:text-zinc-400">USD</span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(order.status)}
                          {order.status === "paid" &&
                            order.createdAt &&
                            Date.now() - order.createdAt > 24 * 60 * 60 * 1000 && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                <Clock className="w-2.5 h-2.5" /> Overdue (&gt;24h)
                              </span>
                            )}
                          {order.status === "whatsapp_initiated" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              <AlertCircle className="w-2.5 h-2.5" /> Needs Payment
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Triggers */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Confirm WhatsApp Payment Button */}
                          {order.status === "whatsapp_initiated" && (
                            <button
                              onClick={() => setConfirmWhatsAppOrder(order)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
                              title={t("confirmWhatsAppBtn")}
                            >
                              Confirm $
                            </button>
                          )}

                          {/* 2. Dispatch Button */}
                          {order.status === "paid" && (
                            <button
                              onClick={() => {
                                setDispatchModalOrder(order);
                                setCarrierInput(order.carrier || "USPS");
                                setTrackingInput(order.trackingNumber || "");
                                setAdminNotesInput(order.adminNotes || "");
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-moya-red hover:bg-moya-red-light text-white shadow-xs transition-colors flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" /> Dispatch
                            </button>
                          )}

                          {/* 3. Mark Delivered with Confirmation Dialog */}
                          {order.status === "dispatched" && (
                            <button
                              onClick={() => setDeliverModalOrder(order)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors"
                            >
                              Delivered
                            </button>
                          )}

                          {/* Ping WhatsApp */}
                          {order.customerPhone && (
                            <button
                              onClick={() => openWhatsAppCustomer(order)}
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                              title="Open WhatsApp Chat with Customer"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* View Drawer Arrow */}
                          <button
                            onClick={() => handleSelectOrder(order)}
                            className="p-1 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Order Detail Drawer ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0d0d14] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-white/10 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between bg-zinc-50/50 dark:bg-white/[0.01]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  Fulfillment Inspector
                </span>
                <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{selectedOrder.orderNumber}</span>
                  {getStatusBadge(selectedOrder.status)}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/orders/${selectedOrder.orderNumber}`}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-colors"
                  title="Open dedicated full page workspace"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-moya-red" />
                  <span>Full Page ↗</span>
                </Link>

                <button
                  onClick={() => handleSelectOrder(null)}
                  className="p-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Card */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold block">
                  Customer & Delivery Details
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-medium">
                    <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span>{selectedOrder.customerName || "Guest Checkout"}</span>
                  </div>

                  {selectedOrder.customerEmail && (
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Mail className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      <span>{selectedOrder.customerEmail}</span>
                    </div>
                  )}

                  {selectedOrder.customerPhone && (
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        <span>{selectedOrder.customerPhone}</span>
                      </div>
                      <button
                        onClick={() => openWhatsAppCustomer(selectedOrder)}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Ping WhatsApp
                      </button>
                    </div>
                  )}

                  {selectedOrder.shippingAddress && (
                    <div className="pt-2 border-t border-zinc-200/60 dark:border-white/[0.04] space-y-1.5">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                          {t("shippingTo")}
                        </span>
                        {selectedOrder.status !== "dispatched" && selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
                          <button
                            onClick={() => handleOpenEditAddress(selectedOrder)}
                            className="text-[11px] font-semibold text-moya-red hover:underline flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> {t("editShippingBtn")}
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 text-xs">
                        <MapPin className="w-4 h-4 text-moya-red shrink-0 mt-0.5" />
                        <div>
                          <div>{selectedOrder.shippingAddress.line1}</div>
                          {selectedOrder.shippingAddress.line2 && <div>{selectedOrder.shippingAddress.line2}</div>}
                          <div>
                            {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                          </div>
                          <div className="font-semibold text-zinc-900 dark:text-white uppercase text-[10px] mt-0.5">
                            {selectedOrder.shippingAddress.country}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold block">
                  Items Breakdown ({selectedOrder.items.length})
                </span>

                <div className="space-y-2">
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between bg-white dark:bg-white/[0.01]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 relative overflow-hidden shrink-0">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain p-1"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            ID: {item.variantId} • Qty: {item.quantity}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                        ${item.price * item.quantity} USD
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fulfillment & Tracking Section */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold block">
                  Carrier & Courier Dispatch
                </span>

                {selectedOrder.trackingNumber ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">Courier:</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {selectedOrder.carrier || "USPS"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">Tracking Code:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900 dark:text-white">
                        <span>{selectedOrder.trackingNumber}</span>
                        <button
                          onClick={() => handleCopy(selectedOrder.trackingNumber)}
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"
                          title="Copy tracking"
                        >
                          {copiedTracking ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <a
                      href={getCarrierTrackingUrl(selectedOrder.carrier, selectedOrder.trackingNumber) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 transition-colors mt-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t("trackCarrierBtn")} ({selectedOrder.carrier ? selectedOrder.carrier.split(" ")[0] : "Courier"})</span>
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    No tracking assigned yet.
                  </div>
                )}

                {/* Dispatch Trigger Button */}
                {selectedOrder.status === "paid" && (
                  <button
                    onClick={() => {
                      setDispatchModalOrder(selectedOrder);
                      setCarrierInput(selectedOrder.carrier || "USPS");
                      setTrackingInput(selectedOrder.trackingNumber || "");
                      setAdminNotesInput(selectedOrder.adminNotes || "");
                    }}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5" /> Dispatch Shipment Now
                  </button>
                )}
              </div>

              {/* Financial Summary */}
              <div className="space-y-2 text-xs pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono">${Number(selectedOrder.subtotal || selectedOrder.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Shipping Fee</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {selectedOrder.shippingFee ? `$${Number(selectedOrder.shippingFee).toFixed(2)}` : "FREE (Global Express)"}
                  </span>
                </div>
                {typeof selectedOrder.tax === "number" && selectedOrder.tax > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>
                      Sales Tax
                      {selectedOrder.taxDetails?.jurisdiction ? ` (${selectedOrder.taxDetails.jurisdiction})` : ""}
                      {selectedOrder.taxDetails?.rate !== undefined
                        ? ` @ ${selectedOrder.taxDetails.rate > 1 ? selectedOrder.taxDetails.rate : (selectedOrder.taxDetails.rate * 100).toFixed(2)}%`
                        : ""}
                    </span>
                    <span className="font-mono text-zinc-950 dark:text-white font-medium">
                      ${selectedOrder.tax.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-zinc-950 dark:text-white pt-2 border-t border-zinc-200 dark:border-white/[0.06]">
                  <span>Total Paid</span>
                  <span className="font-mono">${Number(selectedOrder.total).toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.01] flex items-center justify-between gap-3">
              {selectedOrder.status !== "cancelled" ? (
                <button
                  onClick={() => handleOpenCancelModal(selectedOrder)}
                  className="py-2 px-3 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold transition-colors"
                >
                  {t("cancelOrder")}
                </button>
              ) : (
                <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                  Order Cancelled & Restocked
                </span>
              )}

              <div className="flex items-center gap-2">
                {selectedOrder.status === "whatsapp_initiated" && (
                  <button
                    onClick={() => setConfirmWhatsAppOrder(selectedOrder)}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    {t("confirmWhatsAppBtn")}
                  </button>
                )}

                {selectedOrder.status === "paid" && (
                  <button
                    onClick={() => {
                      setDispatchModalOrder(selectedOrder);
                      setCarrierInput(selectedOrder.carrier || "USPS");
                      setTrackingInput(selectedOrder.trackingNumber || "");
                      setAdminNotesInput(selectedOrder.adminNotes || "");
                    }}
                    className="py-2 px-4 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-moya-red/20"
                  >
                    <Truck className="w-3.5 h-3.5" /> {t("dispatchBtn")}
                  </button>
                )}

                {selectedOrder.status === "dispatched" && (
                  <button
                    onClick={() => setDeliverModalOrder(selectedOrder)}
                    className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> {t("markDelivered")}
                  </button>
                )}

                {selectedOrder.status === "delivered" && (
                  <button
                    onClick={() => setRevertModalOrder(selectedOrder)}
                    className="py-2 px-3 rounded-xl border border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-semibold transition-colors flex items-center gap-1"
                    title={t("revertBtn")}
                  >
                    <Undo2 className="w-3.5 h-3.5" /> {t("revertBtn")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 1: Confirm WhatsApp Offline Payment ── */}
      {confirmWhatsAppOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("confirmWhatsAppTitle")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {t("confirmWhatsAppDesc")}
              </p>
              <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 font-mono text-xs">
                Order <span className="font-bold text-zinc-900 dark:text-white">{confirmWhatsAppOrder.orderNumber}</span> • Total: <span className="font-bold text-emerald-600">${confirmWhatsAppOrder.total} USD</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmWhatsAppOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWhatsAppPayment}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-md shadow-emerald-600/20"
              >
                {isProcessing ? "Deducting Stock..." : t("confirmWhatsAppBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Dispatch Order & Courier Assignment ── */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                  {t("dispatchTitle")}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {t("dispatchDesc")}
                </p>
              </div>
            </div>

            {/* Order Identity Context Badge */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  {dispatchModalOrder.orderNumber}
                </span>
                <span className="text-zinc-500 block text-[11px] mt-0.5">
                  {dispatchModalOrder.customerName || dispatchModalOrder.customerEmail || "Customer"} • {dispatchModalOrder.shippingAddress?.city ? `${dispatchModalOrder.shippingAddress.city}, ` : ""}{dispatchModalOrder.shippingAddress?.country || "US"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  ${dispatchModalOrder.total} {dispatchModalOrder.currency?.toUpperCase() || "USD"}
                </span>
                {dispatchModalOrder.customerPhone && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <MessageCircle className="w-3 h-3" /> {dispatchModalOrder.customerPhone}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("carrierLabel")}
                  </label>
                  <select
                    value={carrierInput}
                    onChange={(e) => setCarrierInput(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red font-medium"
                  >
                    <option value="USPS">USPS Priority Mail</option>
                    <option value="UPS">UPS Ground</option>
                    <option value="FedEx">FedEx Express</option>
                    <option value="DHL Express">DHL Express</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("trackingLabel")}
                  </label>
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="e.g. GL-TRK-749204 or 1234567890"
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  {t("adminNotesLabel")} <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  rows={2}
                  placeholder="Packed in custom 0880 luxury box with sticker pack..."
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red resize-none"
                />
              </div>
            </div>

            {/* Buttons Layout */}
            <div className="pt-3 border-t border-zinc-100 dark:border-white/[0.06] space-y-2.5">
              {dispatchModalOrder.customerPhone ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDispatchOrder(true)}
                    disabled={isProcessing}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-98 disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>{isProcessing ? "Processing..." : t("dispatchAndNotify")}</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDispatchModalOrder(null)}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDispatchOrder(false)}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>{isProcessing ? "Updating Dispatch..." : t("dispatchBtn")}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDispatchModalOrder(null)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchOrder(false)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20 disabled:opacity-50"
                  >
                    {isProcessing ? "Updating Dispatch..." : t("dispatchBtn")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Cancel & Restock (With Stripe Refund Option) ── */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-red-500/20 dark:border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("cancelOrder")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {t("cancelConfirmDesc")}
              </p>
              <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 font-mono text-xs text-left space-y-1">
                <div>Order: <span className="font-bold">{cancelModalOrder.orderNumber}</span></div>
                <div>Customer: <span className="font-semibold">{cancelModalOrder.customerName || "Customer"}</span></div>
                <div>Payment: <span className="font-semibold uppercase">{cancelModalOrder.paymentMethod}</span></div>
                <div>Items to restore: <span className="font-bold text-emerald-600">{cancelModalOrder.items.reduce((s: number, i: any) => s + i.quantity, 0)} units</span></div>
              </div>
            </div>

            {/* Stripe Refund Toggle */}
            {cancelModalOrder.paymentMethod === "stripe" && cancelModalOrder.stripeSessionId && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-left space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-zinc-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={refundStripeToggle}
                    onChange={(e) => setRefundStripeToggle(e.target.checked)}
                    className="w-4 h-4 rounded text-moya-red accent-moya-red"
                  />
                  <span>{t("stripeRefundLabel")} (${cancelModalOrder.total} USD)</span>
                </label>
                <p className="text-[11px] text-zinc-500 pl-6 leading-relaxed">
                  {t("stripeRefundDesc")}
                </p>
              </div>
            )}

            {/* Reason / Admin note input */}
            <div className="text-left">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                {t("cancelReasonLabel")}
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Customer request or shipping address unreachable"
                className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelAndRestock}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-md shadow-red-600/20"
              >
                {isProcessing ? "Processing..." : "Confirm Cancel & Restock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: Confirm Delivery Completed ── */}
      {deliverModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-purple-500/20 dark:border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("deliverTitle")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {t("deliverDesc")}
              </p>
              <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 font-mono text-xs text-left space-y-1">
                <div>Order: <span className="font-bold">{deliverModalOrder.orderNumber}</span></div>
                <div>Recipient: <span className="font-semibold">{deliverModalOrder.customerName || "Customer"}</span></div>
                <div>Courier: <span className="font-semibold">{deliverModalOrder.carrier || "Express"}</span></div>
                {deliverModalOrder.trackingNumber && (
                  <div>Tracking: <span className="font-bold text-blue-600 dark:text-blue-400">{deliverModalOrder.trackingNumber}</span></div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeliverModalOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivered}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors shadow-md shadow-purple-600/20"
              >
                {isProcessing ? "Confirming..." : t("confirmDeliverBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 5: Revert to Dispatched ── */}
      {revertModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Undo2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("revertTitle")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {t("revertDesc")}
              </p>
              <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 font-mono text-xs text-left space-y-1">
                <div>Order: <span className="font-bold">{revertModalOrder.orderNumber}</span></div>
                <div>Current: <span className="font-semibold text-purple-600">Delivered</span></div>
                <div>Target: <span className="font-semibold text-blue-600">Dispatched</span></div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRevertModalOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold transition-colors"
              >
                {isProcessing ? "Reverting..." : t("revertBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 6: Edit Shipping Address & Recipient Details ── */}
      {editAddressOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-lg w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
              <div>
                <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                  {t("editAddressTitle")}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Order #{editAddressOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditAddressOrder(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddressAdmin} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={addressForm.customerName}
                    onChange={(e) => setAddressForm({ ...addressForm, customerName: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Courier Phone</label>
                  <input
                    type="tel"
                    value={addressForm.customerPhone}
                    onChange={(e) => setAddressForm({ ...addressForm, customerPhone: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={addressForm.customerEmail}
                  onChange={(e) => setAddressForm({ ...addressForm, customerEmail: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Street Address (Line 1)</label>
                <input
                  type="text"
                  required
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Apt, Suite, Unit (Line 2)</label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">State / Prov</label>
                  <input
                    type="text"
                    required
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Postal Code</label>
                  <input
                    type="text"
                    required
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Country</label>
                <input
                  type="text"
                  required
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-1 focus:ring-moya-red uppercase"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditAddressOrder(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20"
                >
                  {isProcessing ? "Saving..." : t("saveAddressBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
