"use client";

import React, { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  FALLBACK_PRESET_ID,
  getParcelPreset,
  PARCEL_PRESETS,
  presetDescription,
  presetName,
  presetToParcel,
} from "@convex/shipping/parcels";
import {
  Printer,
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  X,
  Sparkles,
  Zap,
  DollarSign,
  Clock,
  Shield,
  FileText,
  MapPin,
  Edit3,
  Save,
} from "lucide-react";
import { getCarrierTrackingUrl } from "@/lib/tracking";

export interface ShippingLabelModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  /** Buy a new label for an Order in delivery exception or returned to sender (CONTEXT.md "Reship"). */
  reship?: boolean;
}

// Parcel presets come from convex/shipping/parcels.ts (shared with the rates action).

export function ShippingLabelModal({
  order,
  isOpen,
  onClose,
  onSuccess,
  reship = false,
}: ShippingLabelModalProps) {
  const getRates = useAction(api.shipping.functions.getShippingRates);
  const buyLabel = useAction(api.shipping.functions.buyShippingLabel);
  const updateAddress = useMutation(api.orders.desk.updateShippingAddressAdmin);
  const locale = useLocale();

  // Address edit state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  // Box preset & custom dimensions state. The server picks the default from the order's
  // caps and tees (convex/shipping/queries.ts); until it answers, the 1-cap box stands in.
  const suggestion = useQuery(
    api.shipping.queries.suggestParcelForOrder,
    isOpen && order?._id ? { orderId: order._id as Id<"orders"> } : "skip"
  );
  const defaultPresetId = suggestion?.presetId ?? FALLBACK_PRESET_ID;
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPresetId);

  const [dimensions, setDimensions] = useState(presetToParcel(getParcelPreset(FALLBACK_PRESET_ID)!));

  const [labelFormat, setLabelFormat] = useState<"PDF_4x6" | "PDF">("PDF_4x6");

  // Rates query state
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [isPoBox, setIsPoBox] = useState(false);

  // Purchasing state
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasedLabel, setPurchasedLabel] = useState<{
    trackingNumber: string;
    labelUrl: string;
    carrier: string;
    serviceLevel?: string;
  } | null>(null);

  const [copiedTracking, setCopiedTracking] = useState(false);

  // Sync dimensions when preset changes
  useEffect(() => {
    if (selectedPresetId === "custom") return;
    const preset = getParcelPreset(selectedPresetId);
    if (preset) setDimensions(presetToParcel(preset));
  }, [selectedPresetId]);

  // Adopt the server's suggestion once it arrives, unless the admin already chose a box.
  // The first rate fetch may have used the stand-in box, so fetch again for the suggested one.
  const [presetTouched, setPresetTouched] = useState(false);
  useEffect(() => {
    if (!isOpen || !order || presetTouched || !suggestion) return;
    if (suggestion.presetId === selectedPresetId) return;
    const preset = getParcelPreset(suggestion.presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    const dims = presetToParcel(preset);
    setDimensions(dims);
    const canQuote = !purchasedLabel && Boolean(order.shippingAddress?.line1 && order.shippingAddress?.postalCode);
    if (canQuote) fetchRatesForOrder(order._id, dims);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?._id, presetTouched, suggestion?.presetId]);

  // Reset or initialize state when order opens
  useEffect(() => {
    if (!isOpen || !order) {
      setRates([]);
      setSelectedRateId(null);
      setRateError(null);
      setPurchasedLabel(null);
      setPurchaseError(null);
      setIsPoBox(false);
      setIsEditingAddress(false);
      setAddressError(null);
      return;
    }

    // Populate initial address form
    setAddressForm({
      name: order.customerName || "",
      phone: order.customerPhone || "",
      line1: order.shippingAddress?.line1 || "",
      line2: order.shippingAddress?.line2 || "",
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || "",
      postalCode: order.shippingAddress?.postalCode || "",
      country: order.shippingAddress?.country || "US",
    });

    // Check if valid destination address exists
    const hasValidAddress = Boolean(
      order.shippingAddress?.line1 &&
        order.shippingAddress?.city &&
        order.shippingAddress?.state &&
        order.shippingAddress?.postalCode
    );

    setIsEditingAddress(!hasValidAddress);

    // If order already has a shipping label, populate it (a Reship buys a fresh one instead)
    if (!reship && order.shippingLabelUrl && order.trackingNumber) {
      setPurchasedLabel({
        trackingNumber: order.trackingNumber,
        labelUrl: order.shippingLabelUrl,
        carrier: order.carrier || order.shippingCarrier || "Carrier",
        serviceLevel: order.shippingServiceLevel,
      });
    } else {
      setPurchasedLabel(null);
      setPresetTouched(false);
      setSelectedPresetId(defaultPresetId);
      const preset = getParcelPreset(defaultPresetId) ?? getParcelPreset(FALLBACK_PRESET_ID)!;
      const initialDims = presetToParcel(preset);
      setDimensions(initialDims);

      if (hasValidAddress) {
        fetchRatesForOrder(order._id, initialDims);
      } else {
        setRateError("Please save a destination shipping address below to retrieve postage rates.");
        setRates([]);
      }
    }
  }, [isOpen, order?._id, reship]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?._id) return;

    if (
      !addressForm.line1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !addressForm.postalCode.trim()
    ) {
      setAddressError("Please enter Street Address, City, State, and ZIP Code.");
      return;
    }

    const cleanState = addressForm.state.trim().toUpperCase();
    if (cleanState.length !== 2) {
      setAddressError("State must be a 2-letter US state abbreviation (e.g. NY, CA, FL, TX).");
      return;
    }

    // Excluded territory safeguard (Puerto Rico)
    if (cleanState === "PR" || ["006", "007", "009"].includes(addressForm.postalCode.trim().slice(0, 3))) {
      setAddressError("Good Luck currently ships exclusively to the 50 US States (excluding Puerto Rico).");
      return;
    }

    setIsSavingAddress(true);
    setAddressError(null);

    try {
      await updateAddress({
        orderId: order._id,
        shippingAddress: {
          line1: addressForm.line1.trim(),
          line2: addressForm.line2.trim() || undefined,
          city: addressForm.city.trim(),
          state: cleanState,
          postalCode: addressForm.postalCode.trim(),
          country: "US",
        },
        customerName: addressForm.name.trim() || undefined,
        customerPhone: addressForm.phone.trim() || undefined,
      });

      setIsEditingAddress(false);
      // Immediately calculate live rates with newly saved address!
      await fetchRatesForOrder(order._id, dimensions);
    } catch (err: any) {
      console.error("Failed to save address:", err);
      setAddressError(err?.message || "Failed to update address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const fetchRatesForOrder = async (orderId: Id<"orders">, dims: typeof dimensions) => {
    setIsLoadingRates(true);
    setRateError(null);
    try {
      const res = await getRates({
        orderId,
        parcel: dims,
      });

      if (res.success && res.rates.length > 0) {
        setRates(res.rates);
        setIsSandboxMode(res.isSandbox);
        setIsPoBox(Boolean(res.isPoBox));

        // Default to cheapest compatible rate
        const compatibleRates = res.rates.filter((r) => !r.isPoBoxIncompatible);
        const cheapest = compatibleRates.find((r) => r.isCheapest) || compatibleRates[0] || res.rates[0];
        setSelectedRateId(cheapest?.objectId || null);
      } else {
        setRates([]);
        setIsSandboxMode(false);
        setRateError(res.error || "No carrier rates available for this destination.");
      }
    } catch (err: any) {
      console.error("Failed to fetch shipping rates:", err);
      setRates([]);
      setIsSandboxMode(false);
      setRateError(err?.message || "Could not retrieve shipping rates.");
    } finally {
      setIsLoadingRates(false);
    }
  };

  const handleRefreshRates = () => {
    if (!order?._id) return;
    fetchRatesForOrder(order._id, dimensions);
  };

  const handleBuyLabel = async () => {
    if (!order?._id || !selectedRateId) return;

    const chosenRate = rates.find((r) => r.objectId === selectedRateId);
    if (!chosenRate) return;

    if (chosenRate.isPoBoxIncompatible) {
      setPurchaseError("Cannot purchase UPS for a P.O. Box address. Please select USPS Ground Advantage or Priority Mail.");
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const res = await buyLabel({
        orderId: order._id,
        rateObjectId: selectedRateId,
        labelFileType: labelFormat,
        carrier: chosenRate.provider,
        serviceLevel: chosenRate.serviceName,
        amount: chosenRate.amount,
        estimatedDays: chosenRate.estimatedDays,
        parcel: dimensions,
        ...(reship && { reship: true }),
      });

      if (res.success) {
        setPurchasedLabel({
          trackingNumber: res.trackingNumber,
          labelUrl: res.labelUrl,
          carrier: res.carrier,
          serviceLevel: res.serviceLevel,
        });

        if (onSuccess) {
          onSuccess(
            `${reship ? "Reship label" : "Shipping label"} purchased! Tracking ${res.trackingNumber} assigned via ${res.carrier}. Customer dispatch email sent.`
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to purchase shipping label:", err);
      setPurchaseError(err?.message || "Label purchase failed.");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleCopyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handlePrintLabel = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isOpen || !order) return null;

  const selectedRate = rates.find((r) => r.objectId === selectedRateId);
  const trackingUrl = getCarrierTrackingUrl(
    purchasedLabel?.carrier || order.carrier,
    purchasedLabel?.trackingNumber || order.trackingNumber
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-7 text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  {reship ? "Reship: New Label" : "Multi-Carrier Shipping & Labels"}
                </h3>
                {isSandboxMode && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Sandbox Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Instant commercial rates, 4x6 thermal printing, and auto-dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order & Recipient Context Bar */}
        <div className="mt-4 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm">
                #{order.orderNumber}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300">
                {order.items?.length || 1} {order.items?.length === 1 ? "Item" : "Items"}
                {suggestion
                  ? ` (${suggestion.caps} ${suggestion.caps === 1 ? "Cap" : "Caps"}${suggestion.tees ? `, ${suggestion.tees} ${suggestion.tees === 1 ? "Tee" : "Tees"}` : ""})`
                  : ""}
              </span>
            </div>
            <div className="text-zinc-400 text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>
                Recipient: <strong className="text-zinc-200">{order.customerName || "Customer"}</strong>
              </span>
              <span>•</span>
              {order.shippingAddress?.line1 ? (
                <span className="text-zinc-300 font-mono text-[11px]">
                  {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </span>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Destination address required
                </span>
              )}

              {!purchasedLabel && (
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  className="ml-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditingAddress ? "Cancel" : order.shippingAddress?.line1 ? "Edit Address" : "Enter Address"}
                </button>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-zinc-500 block">Order Value</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              ${order.total?.toFixed(2)} {order.currency?.toUpperCase() || "USD"}
            </span>
          </div>
        </div>

        {/* Inline Destination Address Form */}
        {isEditingAddress && !purchasedLabel && (
          <form
            onSubmit={handleSaveAddress}
            className="mt-3 p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                Destination Shipping Address
              </span>
              <span className="text-[10px] text-zinc-400">Domestic 50 US States only</span>
            </div>

            {addressError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{addressError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Recipient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Melendez"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Phone Number (Carrier Contact)</label>
                <input
                  type="tel"
                  placeholder="e.g. 5550100100"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-zinc-400 block mb-1">Street Address (Line 1)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 123 Main St"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-zinc-400 block mb-1">
                  Apartment, Suite, Unit (Line 2 - Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apt 4B"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">City</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Bronx"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">State (2-Letter)</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="NY"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value.toUpperCase() })}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">ZIP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10456"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {order.shippingAddress?.line1 && (
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(false)}
                  className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingAddress}
                className="py-1.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSavingAddress ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Address & Fetch Rates
              </button>
            </div>
          </form>
        )}

        {/* CASE A: Label Already Purchased */}
        {purchasedLabel ? (
          <div className="mt-5 space-y-4">
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Postage Label Active & Dispatched</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Postage has been purchased for this order. The customer has been emailed their dispatch tracking notification and the order tracking page has been updated.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-800 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Carrier & Service</span>
                  <span className="text-white font-bold text-sm">
                    {purchasedLabel.carrier} {purchasedLabel.serviceLevel ? `• ${purchasedLabel.serviceLevel}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Tracking Number</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-amber-400 font-bold text-sm">
                      {purchasedLabel.trackingNumber}
                    </span>
                    <button
                      onClick={() => handleCopyTracking(purchasedLabel.trackingNumber)}
                      className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                      title="Copy Tracking Number"
                    >
                      {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handlePrintLabel(purchasedLabel.labelUrl)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                Print Shipping Label (PDF)
              </button>

              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  Carrier Tracking
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setPurchasedLabel(null);
                  fetchRatesForOrder(order._id, dimensions);
                }}
                className="w-full sm:w-auto py-3 px-3 rounded-xl bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
              >
                Re-calculate Rates
              </button>
            </div>
          </div>
        ) : (
          /* CASE B: Rate Selection & Label Purchase Flow */
          <div className="mt-5 space-y-5">
            {/* 1. Box Preset Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  1. Select Packaging Box
                </label>
                <span className="text-[11px] text-zinc-500">
                  Boxes for caps; mailers for tees only
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PARCEL_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPresetTouched(true);
                        setSelectedPresetId(preset.id);
                      }}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/50 text-white shadow-sm shadow-amber-500/10"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{presetName(preset, locale)}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-1">
                        {preset.length}&quot; × {preset.width}&quot; × {preset.height}&quot; • {preset.weight} oz
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {presetDescription(preset, locale)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Dimensions Collapsible */}
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPresetTouched(true);
                    setSelectedPresetId(selectedPresetId === "custom" ? defaultPresetId : "custom");
                  }}
                  className="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                >
                  <span>{selectedPresetId === "custom" ? "− Hide custom dimensions" : "+ Adjust custom dimensions / weight"}</span>
                </button>

                {selectedPresetId === "custom" && (
                  <div className="mt-2 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Length (in)</label>
                      <input
                        type="number"
                        min="1"
                        value={dimensions.length}
                        onChange={(e) => setDimensions({ ...dimensions, length: Number(e.target.value) })}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Width (in)</label>
                      <input
                        type="number"
                        min="1"
                        value={dimensions.width}
                        onChange={(e) => setDimensions({ ...dimensions, width: Number(e.target.value) })}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Height (in)</label>
                      <input
                        type="number"
                        min="1"
                        value={dimensions.height}
                        onChange={(e) => setDimensions({ ...dimensions, height: Number(e.target.value) })}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Weight (oz)</label>
                      <input
                        type="number"
                        min="1"
                        value={dimensions.weight}
                        onChange={(e) => setDimensions({ ...dimensions, weight: Number(e.target.value) })}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Live Carrier Rates Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  2. Choose Carrier & Service Rate
                </label>

                <button
                  type="button"
                  onClick={handleRefreshRates}
                  disabled={isLoadingRates}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <RotateCw className={`w-3 h-3 ${isLoadingRates ? "animate-spin text-amber-400" : ""}`} />
                  Refresh Rates
                </button>
              </div>

              {isSandboxMode && !rateError && (
                <div
                  role="alert"
                  className="p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>
                    <strong>Sandbox rates — not real postage.</strong> A label bought here has a made-up tracking
                    number and a sample PDF. Never use it for a real order.
                  </span>
                </div>
              )}

              {isPoBox && (
                <div className="p-3 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <MapPin className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>P.O. Box Address:</strong> USPS Ground Advantage or Priority Mail is required. Commercial couriers (UPS) cannot deliver to P.O. Boxes.
                  </span>
                </div>
              )}

              {isLoadingRates ? (
                <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-2">
                  <RotateCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                  <p className="text-xs text-zinc-400">Comparing commercial live postage rates...</p>
                </div>
              ) : rateError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{rateError}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {rates.map((rate) => {
                    const isSelected = selectedRateId === rate.objectId;
                    const isDisabled = Boolean(rate.isPoBoxIncompatible);

                    return (
                      <div
                        key={rate.objectId}
                        onClick={() => {
                          if (!isDisabled) {
                            setSelectedRateId(rate.objectId);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isDisabled
                            ? "bg-zinc-950/40 border-zinc-800/40 opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "bg-amber-500/10 border-amber-500/60 shadow-md shadow-amber-500/5 cursor-pointer"
                            : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isDisabled
                                ? "border-zinc-800 bg-zinc-900"
                                : isSelected
                                ? "border-amber-400 bg-amber-400"
                                : "border-zinc-600 bg-transparent"
                            }`}
                          >
                            {isSelected && !isDisabled && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-xs ${isDisabled ? "text-zinc-500" : "text-white"}`}>
                                {rate.serviceName}
                              </span>

                              {rate.isPoBoxIncompatible && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                  P.O. Box Incompatible
                                </span>
                              )}

                              {rate.recommendedTag && !rate.isPoBoxIncompatible && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> {rate.recommendedTag}
                                </span>
                              )}

                              {rate.isCheapest && !rate.isPoBoxIncompatible && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  <DollarSign className="w-2.5 h-2.5" /> Cheapest
                                </span>
                              )}
                              {rate.isFastest && !rate.isPoBoxIncompatible && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" /> Fastest
                                </span>
                              )}
                              {rate.attributes?.includes("BESTVALUE") && !rate.isPoBoxIncompatible && !rate.recommendedTag && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> Best Value
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span>{rate.provider}</span>
                              {rate.durationTerms && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-zinc-500" />
                                    {rate.durationTerms}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`font-mono font-bold text-sm ${isDisabled ? "text-zinc-600" : "text-emerald-400"}`}>
                            ${rate.amount?.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-zinc-500 block">USD</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Label Format Selector */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Print Format:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLabelFormat("PDF_4x6")}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    labelFormat === "PDF_4x6"
                      ? "bg-amber-500 text-zinc-950 font-bold"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  4&quot; × 6&quot; Thermal (Rollo/Zebra)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat("PDF")}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    labelFormat === "PDF"
                      ? "bg-amber-500 text-zinc-950 font-bold"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  8.5&quot; × 11&quot; Standard Sheet
                </button>
              </div>
            </div>

            {purchaseError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{purchaseError}</span>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isPurchasing}
                className="py-2.5 px-4 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleBuyLabel}
                disabled={isPurchasing || !selectedRateId || isLoadingRates}
                className="flex-1 py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
              >
                {isPurchasing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Purchasing Postage & Generating Label...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>
                      Buy Postage & Dispatch ({selectedRate ? `$${selectedRate.amount.toFixed(2)}` : "Select Rate"})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShippingLabelModal;
