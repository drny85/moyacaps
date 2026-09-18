"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
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
} from "lucide-react";

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

  // Modals state
  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [carrierInput, setCarrierInput] = useState("DHL Express");
  const [trackingInput, setTrackingInput] = useState("");
  const [adminNotesInput, setAdminNotesInput] = useState("");

  const [confirmWhatsAppOrder, setConfirmWhatsAppOrder] = useState<any | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);

  const [copiedTracking, setCopiedTracking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Convex queries & mutations
  const orders = useQuery(api.orders.getAllOrdersAdmin, {
    status: statusFilter,
    paymentMethod: paymentFilter,
    search: searchQuery,
  });

  const updateOrderStatus = useMutation(api.orders.updateOrderStatusAdmin);
  const updateOrderFulfillment = useMutation(api.orders.updateOrderFulfillmentAdmin);

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
    } catch (err: any) {
      console.error("Failed to confirm WhatsApp payment", err);
      setActionError(err?.message || "Failed to confirm WhatsApp payment. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispatchOrder = async () => {
    if (!dispatchModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateOrderStatus({
        orderId: dispatchModalOrder._id,
        newStatus: "dispatched",
        carrier: carrierInput,
        trackingNumber: trackingInput.trim() || undefined,
        adminNotes: adminNotesInput.trim() || undefined,
      });
      setDispatchModalOrder(null);
      if (selectedOrder?._id === dispatchModalOrder._id) {
        setSelectedOrder({
          ...selectedOrder,
          status: "dispatched",
          carrier: carrierInput,
          trackingNumber: trackingInput,
          adminNotes: adminNotesInput,
        });
      }
    } catch (err: any) {
      console.error("Failed to dispatch order", err);
      setActionError(err?.message || "Failed to dispatch order. Please check inputs and retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkDelivered = async (order: any) => {
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateOrderStatus({
        orderId: order._id,
        newStatus: "delivered",
      });
      if (selectedOrder?._id === order._id) {
        setSelectedOrder({ ...selectedOrder, status: "delivered" });
      }
    } catch (err: any) {
      console.error("Failed to mark delivered", err);
      setActionError(err?.message || "Failed to update delivery status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAndRestock = async () => {
    if (!cancelModalOrder) return;
    try {
      setIsProcessing(true);
      setActionError(null);
      await updateOrderStatus({
        orderId: cancelModalOrder._id,
        newStatus: "cancelled",
      });
      setCancelModalOrder(null);
      if (selectedOrder?._id === cancelModalOrder._id) {
        setSelectedOrder({ ...selectedOrder, status: "cancelled" });
      }
    } catch (err: any) {
      console.error("Failed to cancel order", err);
      setActionError(err?.message || "Failed to cancel order.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openWhatsAppCustomer = (order: any) => {
    const rawPhone = order.customerPhone || "";
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
    const greeting = locale === "es"
      ? `¡Hola ${order.customerName || "estimado cliente"}! Te contactamos de Moya Caps respecto a tu orden ${order.orderNumber}.`
      : `Hi ${order.customerName || "Customer"}, this is Moya Caps regarding your order ${order.orderNumber}.`;

    const trackingText = order.trackingNumber
      ? locale === "es"
        ? ` Tu número de guía es: ${order.trackingNumber} (${order.carrier || "Express"}).`
        : ` Your express tracking code is: ${order.trackingNumber} (${order.carrier || "Express"}).`
      : "";

    const url = `https://wa.me/${cleanPhone || "5215500000000"}?text=${encodeURIComponent(greeting + trackingText)}`;
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

        {/* Counter */}
        <div className="flex items-center gap-2">
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
            { id: "all", label: t("allStatuses") },
            { id: "paid", label: "Paid" },
            { id: "dispatched", label: "Dispatched" },
            { id: "delivered", label: "Delivered" },
            { id: "whatsapp_initiated", label: "WhatsApp Leads" },
            { id: "cancelled", label: "Cancelled" },
          ].map((pill) => {
            const isSelected = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                    : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {pill.label}
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
                      onClick={() => setSelectedOrder(order)}
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
                        {getStatusBadge(order.status)}
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
                                setCarrierInput(order.carrier || "DHL Express");
                                setTrackingInput(order.trackingNumber || "");
                                setAdminNotesInput(order.adminNotes || "");
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-moya-red hover:bg-moya-red-light text-white shadow-xs transition-colors flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" /> Dispatch
                            </button>
                          )}

                          {/* 3. Mark Delivered */}
                          {order.status === "dispatched" && (
                            <button
                              onClick={() => handleMarkDelivered(order)}
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
                            onClick={() => setSelectedOrder(order)}
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
          <div className="w-full max-w-lg bg-white dark:bg-[#0d0d14] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-white/10 overflow-hidden">
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

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
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
                    <div className="pt-2 border-t border-zinc-200/60 dark:border-white/[0.04] flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                      <MapPin className="w-4 h-4 text-moya-red shrink-0 mt-0.5" />
                      <div>
                        <div>{selectedOrder.shippingAddress.line1}</div>
                        {selectedOrder.shippingAddress.line2 && <div>{selectedOrder.shippingAddress.line2}</div>}
                        <div>
                          {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                        </div>
                        <div className="font-semibold text-zinc-900 dark:text-white uppercase text-[10px]">
                          {selectedOrder.shippingAddress.country}
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
                        {selectedOrder.carrier || "DHL Express"}
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
                      setCarrierInput(selectedOrder.carrier || "DHL Express");
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
                  <span className="font-mono">${selectedOrder.subtotal || selectedOrder.total}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Shipping Fee</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {selectedOrder.shippingFee ? `$${selectedOrder.shippingFee}` : "FREE (Global Express)"}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-zinc-950 dark:text-white pt-2 border-t border-zinc-200 dark:border-white/[0.06]">
                  <span>Total Paid</span>
                  <span className="font-mono">${selectedOrder.total} USD</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.01] flex items-center justify-between gap-3">
              {selectedOrder.status !== "cancelled" ? (
                <button
                  onClick={() => setCancelModalOrder(selectedOrder)}
                  className="py-2 px-3 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold transition-colors"
                >
                  {t("cancelOrder")}
                </button>
              ) : (
                <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                  Order Cancelled & Restocked
                </span>
              )}

              {selectedOrder.status === "whatsapp_initiated" && (
                <button
                  onClick={() => setConfirmWhatsAppOrder(selectedOrder)}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  {t("confirmWhatsAppBtn")}
                </button>
              )}
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
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                {t("dispatchTitle")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                {t("dispatchDesc")}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  {t("carrierLabel")}
                </label>
                <select
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red font-medium"
                >
                  <option value="DHL Express">DHL Express Worldwide</option>
                  <option value="FedEx International">FedEx International Priority</option>
                  <option value="Correos de México">Correos de México Express</option>
                  <option value="Estafeta">Estafeta Express</option>
                  <option value="UPS Worldwide">UPS Worldwide Saver</option>
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
                  placeholder="e.g. MC-TRK-749204 or 1234567890"
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  {t("adminNotesLabel")} (optional)
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

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDispatchModalOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchOrder}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20"
              >
                {isProcessing ? "Updating Dispatch..." : t("dispatchBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Cancel & Restock ── */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
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
              <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 font-mono text-xs text-left">
                <div>Order: <span className="font-bold">{cancelModalOrder.orderNumber}</span></div>
                <div>Items to restore: <span className="font-bold text-emerald-600">{cancelModalOrder.items.reduce((s: number, i: any) => s + i.quantity, 0)} units</span></div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelAndRestock}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-md shadow-red-600/20"
              >
                {isProcessing ? "Restocking..." : "Confirm Cancel & Restock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
