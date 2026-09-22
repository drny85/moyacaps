"use client";

import React, { useState, use } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { getCarrierTrackingUrl } from "@/lib/tracking";
import { getWhatsAppAdminCustomerUrl } from "@/lib/whatsapp";
import { Link, useRouter } from "@/i18n/routing";
import {
  ArrowLeft,
  Printer,
  Truck,
  Package,
  MessageCircle,
  Clock,
  ExternalLink,
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
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText,
} from "lucide-react";

export default function DedicatedOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const resolvedParams = use(params);
  const { orderNumber } = resolvedParams;
  const t = useTranslations("admin.orders");
  const locale = useLocale();
  const router = useRouter();

  const order = useQuery(api.orders.getOrderDetailAdmin, {
    orderNumber: decodeURIComponent(orderNumber),
  });

  // Action mutations & actions
  const updateOrderStatus = useMutation(api.orders.updateOrderStatusAdmin);
  const updateOrderFulfillment = useMutation(api.orders.updateOrderFulfillmentAdmin);
  const updateShippingAddressAdmin = useMutation(api.orders.updateShippingAddressAdmin);
  const cancelAndRefundAdmin = useAction(api.stripe.cancelAndRefundOrderAdmin);

  // Local interaction states
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modals state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [carrierInput, setCarrierInput] = useState("USPS");
  const [trackingInput, setTrackingInput] = useState("");
  const [adminNotesInput, setAdminNotesInput] = useState("");

  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [refundStripeToggle, setRefundStripeToggle] = useState(true);
  const [cancelReasonInput, setCancelReasonInput] = useState("");

  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
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

  // Note editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const triggerSuccess = (msg: string) => {
    setFeedbackSuccess(msg);
    setTimeout(() => setFeedbackSuccess(null), 4000);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handlePrintPackingSlip = () => {
    window.print();
  };

  const openWhatsAppCustomer = (ord: any) => {
    const url = getWhatsAppAdminCustomerUrl({
      customerPhone: ord.customerPhone,
      customerName: ord.customerName,
      orderNumber: ord.orderNumber,
      trackingNumber: ord.trackingNumber,
      carrier: ord.carrier,
      locale,
    });
    window.open(url, "_blank");
  };

  const handleOpenEditAddress = () => {
    if (!order) return;
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
    setIsEditAddressOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateShippingAddressAdmin({
        orderId: order._id,
        customerName: addressForm.customerName.trim() || undefined,
        customerEmail: addressForm.customerEmail.trim() || undefined,
        customerPhone: addressForm.customerPhone.trim() || undefined,
        shippingAddress: {
          line1: addressForm.line1.trim(),
          line2: addressForm.line2.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state.trim(),
          postalCode: addressForm.postalCode.trim(),
          country: addressForm.country.trim(),
        },
      });
      setIsEditAddressOpen(false);
      triggerSuccess("Shipping address updated successfully.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to update shipping address.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAdminNotes = async () => {
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateOrderStatus({
        orderId: order._id,
        newStatus: order.status,
        adminNotes: notesDraft.trim(),
      });
      setIsEditingNotes(false);
      triggerSuccess("Internal administrative notes saved.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to save notes.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmWhatsAppPayment = async () => {
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateOrderStatus({
        orderId: order._id,
        newStatus: "paid",
      });
      triggerSuccess("WhatsApp offline payment confirmed. Inventory stock deducted.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to confirm payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateOrderFulfillment({
        orderId: order._id,
        carrier: carrierInput,
        trackingNumber: trackingInput.trim() || undefined,
        adminNotes: adminNotesInput.trim() || undefined,
      });
      setIsDispatchModalOpen(false);
      triggerSuccess(`Order marked as Dispatched via ${carrierInput}.`);
    } catch (err: any) {
      setActionError(err?.message || "Failed to dispatch order.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateOrderStatus({
        orderId: order._id,
        newStatus: "delivered",
      });
      setIsDeliverModalOpen(false);
      triggerSuccess("Order marked as Delivered.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to complete delivery.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRevert = async () => {
    if (!order) return;
    try {
      setIsProcessing(true);
      await updateOrderStatus({
        orderId: order._id,
        newStatus: "dispatched",
      });
      setIsRevertModalOpen(false);
      triggerSuccess("Delivery state reverted back to Dispatched.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to revert status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!order) return;
    try {
      setIsProcessing(true);
      if (order.paymentMethod === "stripe" && refundStripeToggle && order.stripeSessionId) {
        await cancelAndRefundAdmin({
          orderId: order._id,
          reason: cancelReasonInput.trim() || undefined,
          refundStripe: refundStripeToggle,
        });
        triggerSuccess("Order cancelled and Stripe refund executed.");
      } else {
        await updateOrderStatus({
          orderId: order._id,
          newStatus: "cancelled",
          adminNotes: cancelReasonInput.trim() || undefined,
        });
        triggerSuccess("Order cancelled and inventory returned to stock.");
      }
      setIsCancelModalOpen(false);
    } catch (err: any) {
      setActionError(err?.message || "Failed to cancel order.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Paid & Ready
          </span>
        );
      case "dispatched":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Truck className="w-3.5 h-3.5" /> In Transit
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case "whatsapp_initiated":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Pending
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <X className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  if (order === undefined) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-8 h-8 border-2 border-moya-red border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
          Loading order details...
        </p>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <Package className="w-12 h-12 text-zinc-400 mx-auto" />
        <h2 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
          Order Not Found
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm">
          The requested order identifier ({orderNumber}) could not be located in the operational database.
        </p>
        <Link
          href="/admin/orders"
          className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders Desk
        </Link>
      </div>
    );
  }

  const isOverdue =
    order.status === "paid" &&
    order.createdAt &&
    Date.now() - order.createdAt > 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {/* ── Screen Controls Header (Hidden on Print) ── */}
      <div className="print:hidden space-y-4">
        {/* Top Navigation Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders"
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c0c14] hover:bg-zinc-100 dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 transition-colors"
              title="Return to Orders Table"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Fulfillment Inspector
                </span>
                {isOverdue && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1 animate-pulse">
                    <Clock className="w-2.5 h-2.5" /> Overdue (&gt;24h)
                  </span>
                )}
              </div>
              <h1 className="font-display font-bold text-2xl text-zinc-950 dark:text-white flex items-center gap-3">
                <span>{order.orderNumber}</span>
                {getStatusBadge(order.status)}
              </h1>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handlePrintPackingSlip}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c0c14] hover:bg-zinc-50 dark:hover:bg-white/[0.04] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shadow-xs transition-colors"
              title="Print Warehouse Packing Slip & Shipping Manifest"
            >
              <Printer className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>Print Packing Slip</span>
            </button>

            {order.status === "whatsapp_initiated" && (
              <button
                onClick={handleConfirmWhatsAppPayment}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Payment $</span>
              </button>
            )}

            {order.status === "paid" && (
              <button
                onClick={() => {
                  setCarrierInput(order.carrier || "USPS");
                  setTrackingInput(order.trackingNumber || "");
                  setAdminNotesInput(order.adminNotes || "");
                  setIsDispatchModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-moya-red/20"
              >
                <Truck className="w-4 h-4" />
                <span>Dispatch Package</span>
              </button>
            )}

            {order.status === "dispatched" && (
              <button
                onClick={() => setIsDeliverModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Mark Delivered</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)}>
              <X className="w-4 h-4 text-rose-500" />
            </button>
          </div>
        )}

        {feedbackSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{feedbackSuccess}</span>
            </div>
            <button onClick={() => setFeedbackSuccess(null)}>
              <X className="w-4 h-4 text-emerald-500" />
            </button>
          </div>
        )}

        {/* ── Order Status Stepper ── */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Created</p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                  ["paid", "dispatched", "delivered"].includes(order.status)
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-400"
                }`}
              >
                {["paid", "dispatched", "delivered"].includes(order.status) ? "✓" : "2"}
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Payment</p>
                <p className="text-[11px] text-zinc-500 capitalize">{order.paymentMethod}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                  ["dispatched", "delivered"].includes(order.status)
                    ? "bg-blue-500/20 text-blue-500"
                    : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-400"
                }`}
              >
                {["dispatched", "delivered"].includes(order.status) ? "✓" : "3"}
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Dispatched</p>
                <p className="text-[11px] text-zinc-500">
                  {order.carrier ? order.carrier : "Awaiting dispatch"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                  order.status === "delivered"
                    ? "bg-purple-500/20 text-purple-500"
                    : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-400"
                }`}
              >
                {order.status === "delivered" ? "✓" : "4"}
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Delivered</p>
                <p className="text-[11px] text-zinc-500">
                  {order.status === "delivered" ? "Confirmed" : "In transit"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Content Grid ── */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Items & Financials - 2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Purchased Items Card */}
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-3">
              <h2 className="font-display font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-moya-red" />
                <span>Purchased Caps ({order.items.length})</span>
              </h2>
              <span className="text-[10px] font-mono text-zinc-500">
                {order.items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)} units total
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 shrink-0">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-zinc-900 dark:text-white">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        SKU: {item.variantId || "N/A"} • Qty: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <p className="font-bold text-xs text-zinc-900 dark:text-white">
                      ${(item.price * item.quantity).toFixed(2)} USD
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-[10px] text-zinc-500">
                        ${item.price.toFixed(2)} ea
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="pt-4 border-t border-zinc-100 dark:border-white/[0.06] space-y-2 text-xs">
              {order.subtotal !== undefined && (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono">${order.subtotal.toFixed(2)} USD</span>
                </div>
              )}
              {order.shippingFee !== undefined && (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Shipping Fee</span>
                  <span className="font-mono">
                    {order.shippingFee === 0 ? "FREE" : `$${order.shippingFee.toFixed(2)} USD`}
                  </span>
                </div>
              )}
              {order.tax !== undefined && order.tax > 0 && (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>
                    Sales Tax {order.taxDetails?.rate ? `(${order.taxDetails.rate}%)` : ""}
                  </span>
                  <span className="font-mono">${order.tax.toFixed(2)} USD</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] flex justify-between font-bold text-sm text-zinc-900 dark:text-white">
                <span>Total Paid</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${order.total.toFixed(2)} {order.currency || "USD"}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Internal Notes Card */}
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span>Internal Staff Notes</span>
              </h3>
              {!isEditingNotes && (
                <button
                  onClick={() => {
                    setNotesDraft(order.adminNotes || "");
                    setIsEditingNotes(true);
                  }}
                  className="text-xs text-moya-red hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Notes
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Record customer preferences, dispatch instructions, or concierge history..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAdminNotes}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-lg bg-moya-red text-white text-xs font-semibold"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-zinc-50 dark:bg-white/[0.02] p-3 rounded-xl border border-zinc-100 dark:border-white/[0.04] whitespace-pre-wrap">
                {order.adminNotes || "No staff notes recorded for this order yet."}
              </p>
            )}
          </div>
        </div>

        {/* Right Column (Customer, Delivery, Logistics - 1 span) */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
              Customer & Contact
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-medium">
                <User className="w-4 h-4 text-zinc-500" />
                <span>{order.customerName || "Guest Collector"}</span>
              </div>

              {order.customerEmail && (
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  <a href={`mailto:${order.customerEmail}`} className="hover:underline">
                    {order.customerEmail}
                  </a>
                </div>
              )}

              {order.customerPhone && (
                <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-zinc-500" />
                    <span>{order.customerPhone}</span>
                  </div>
                  <button
                    onClick={() => openWhatsAppCustomer(order)}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                Destination Address
              </span>
              {["pending", "paid", "whatsapp_initiated"].includes(order.status) && (
                <button
                  onClick={handleOpenEditAddress}
                  className="text-xs text-moya-red hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            {order.shippingAddress ? (
              <div className="text-xs text-zinc-700 dark:text-zinc-300 font-mono space-y-0.5 leading-relaxed bg-zinc-50 dark:bg-white/[0.02] p-3 rounded-xl border border-zinc-100 dark:border-white/[0.04]">
                <p className="font-semibold text-zinc-900 dark:text-white">
                  {order.shippingAddress.line1}
                </p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No physical shipping address provided.</p>
            )}
          </div>

          {/* Carrier & Tracking Card */}
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
              Logistics & Courier
            </span>

            {order.trackingNumber ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {order.carrier || "USPS"}
                  </span>
                  <button
                    onClick={() => handleCopy(order.trackingNumber || "")}
                    className="text-[11px] text-moya-red hover:underline flex items-center gap-1"
                  >
                    {copiedTracking ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTracking ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <p className="font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                  {order.trackingNumber}
                </p>
                <a
                  href={getCarrierTrackingUrl(order.carrier, order.trackingNumber) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/[0.04] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Track Courier Live</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Awaiting fulfillment dispatch. Tracking not yet assigned.
              </p>
            )}

            {order.status === "dispatched" && (
              <button
                onClick={() => setIsRevertModalOpen(true)}
                className="w-full mt-2 py-1.5 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-medium hover:bg-amber-500/10 flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Revert to Dispatch State
              </button>
            )}
          </div>

          {/* Danger Safeguard Zone */}
          {order.status !== "cancelled" && (
            <div className="bg-white dark:bg-[#0c0c14] border border-rose-500/20 rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-semibold block">
                Danger Zone
              </span>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Cancelling will atomically replenish inventory stock and trigger an integrated Stripe refund if applicable.
              </p>
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Cancel & Restock Order
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PRINT-ONLY PACKING SLIP LAYOUT (Triggered by window.print()) ── */}
      <div className="hidden print:block p-8 font-sans text-black bg-white max-w-3xl mx-auto">
        {/* Packing Slip Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight">GOOD LUCK</h1>
            <p className="text-xs uppercase tracking-widest text-gray-600 font-mono mt-0.5">
              WAREHOUSE PACKING SLIP & DISPATCH INVOICE
            </p>
          </div>
          <div className="text-right font-mono text-xs">
            <p className="font-bold text-sm">Order #{order.orderNumber}</p>
            <p className="text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
            <p className="capitalize font-semibold text-gray-800">Channel: {order.paymentMethod}</p>
          </div>
        </div>

        {/* Destination & Courier Info */}
        <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-300 pb-1">
              Ship To:
            </h3>
            <p className="font-bold text-sm">{order.customerName || "Valued Customer"}</p>
            {order.customerPhone && <p className="font-mono">{order.customerPhone}</p>}
            {order.shippingAddress && (
              <div className="mt-1 space-y-0.5 font-mono">
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="font-bold">{order.shippingAddress.country}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-300 pb-1">
              Fulfillment Logistics:
            </h3>
            <p>
              <strong>Carrier:</strong> {order.carrier || "USPS Worldwide"}
            </p>
            <p className="font-mono">
              <strong>Tracking:</strong> {order.trackingNumber || "Awaiting scan"}
            </p>
            <p>
              <strong>Status:</strong> {order.status.toUpperCase()}
            </p>
            {order.adminNotes && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-[11px] font-mono">
                <strong>Notes:</strong> {order.adminNotes}
              </div>
            )}
          </div>
        </div>

        {/* Itemized Manifest Table */}
        <div className="mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black font-mono uppercase text-[10px]">
                <th className="py-2 w-12 text-center">Verify</th>
                <th className="py-2">Item Description</th>
                <th className="py-2 w-24">SKU / ID</th>
                <th className="py-2 w-12 text-center">Qty</th>
                <th className="py-2 text-right w-20">Price</th>
                <th className="py-2 text-right w-20">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items.map((item: any, idx: number) => (
                <tr key={idx} className="py-2">
                  <td className="py-3 text-center">
                    <span className="inline-block w-4 h-4 border-2 border-black rounded-xs"></span>
                  </td>
                  <td className="py-3 font-semibold">{item.name}</td>
                  <td className="py-3 font-mono text-gray-600">{item.variantId || "-"}</td>
                  <td className="py-3 text-center font-bold">{item.quantity}</td>
                  <td className="py-3 text-right font-mono">${item.price.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono font-bold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box */}
        <div className="border-t-2 border-black pt-3 flex justify-end">
          <div className="w-64 space-y-1 text-xs">
            {order.subtotal !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-mono">${order.subtotal.toFixed(2)}</span>
              </div>
            )}
            {order.shippingFee !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-mono">
                  {order.shippingFee === 0 ? "FREE" : `$${order.shippingFee.toFixed(2)}`}
                </span>
              </div>
            )}
            {order.tax !== undefined && order.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tax:</span>
                <span className="font-mono">${order.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Total Paid:</span>
              <span className="font-mono">
                ${order.total.toFixed(2)} {order.currency || "USD"}
              </span>
            </div>
          </div>
        </div>

        {/* Warehouse Inspection Footer */}
        <div className="mt-10 pt-4 border-t border-gray-300 grid grid-cols-2 text-[11px] text-gray-600">
          <div>
            <p className="font-bold">Packed by:</p>
            <div className="border-b border-gray-400 w-48 h-8"></div>
          </div>
          <div className="text-right">
            <p>Thank you for shopping with Good Luck!</p>
            <p className="font-mono">support@moyacaps.com • moyacaps.com</p>
          </div>
        </div>
      </div>

      {/* ── MODALS (Hidden on Print) ── */}

      {/* Dispatch Modal */}
      {isDispatchModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-moya-red" />
              <span>Dispatch Order #{order.orderNumber}</span>
            </h3>

            <form onSubmit={handleSaveDispatch} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Logistics Carrier:
                </label>
                <select
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                >
                  <option value="USPS">USPS (United States Postal Service)</option>
                  <option value="DHL">DHL Express</option>
                  <option value="FedEx">FedEx International</option>
                  <option value="Estafeta">Estafeta</option>
                  <option value="Correos de México">Correos de México</option>
                  <option value="UPS">UPS Worldwide</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Tracking Number:
                </label>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="e.g. 9400 1000 0000 0000 0000 00"
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Admin Internal Notes (Optional):
                </label>
                <input
                  type="text"
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="e.g. Dispatched via Express priority"
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white font-semibold"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deliver Confirmation Modal */}
      {isDeliverModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              <span>Confirm Delivery</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Are you sure you want to mark order <strong>#{order.orderNumber}</strong> as delivered to {order.customerName}?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDeliverModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelivered}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Mark as Delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Modal */}
      {isRevertModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c0c14] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              <span>Revert to Dispatched State</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              This will return order <strong>#{order.orderNumber}</strong> back to in-transit dispatched status.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRevertModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevert}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold"
              >
                Confirm Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c0c14] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Cancel Order #{order.orderNumber}</span>
            </h3>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to cancel this order? The deducted caps will be restored to live inventory.
            </p>

            {order.paymentMethod === "stripe" && order.stripeSessionId && (
              <label className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundStripeToggle}
                  onChange={(e) => setRefundStripeToggle(e.target.checked)}
                  className="rounded"
                />
                <span>Issue full automatic Stripe refund (${order.total} USD)</span>
              </label>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                Cancellation Reason:
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Customer request or fraud flag"
                className="w-full p-2 text-xs rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancellation}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Address Modal */}
      {isEditAddressOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-moya-red" />
              <span>Modify Delivery Address</span>
            </h3>

            <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Recipient Name:
                </label>
                <input
                  type="text"
                  value={addressForm.customerName}
                  onChange={(e) => setAddressForm({ ...addressForm, customerName: e.target.value })}
                  className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Email:
                  </label>
                  <input
                    type="email"
                    value={addressForm.customerEmail}
                    onChange={(e) => setAddressForm({ ...addressForm, customerEmail: e.target.value })}
                    className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Phone:
                  </label>
                  <input
                    type="text"
                    value={addressForm.customerPhone}
                    onChange={(e) => setAddressForm({ ...addressForm, customerPhone: e.target.value })}
                    className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Address Line 1:
                </label>
                <input
                  type="text"
                  required
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  Address Line 2 (Apt / Suite):
                </label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    City:
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    State:
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Postal Code:
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditAddressOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white font-semibold"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
