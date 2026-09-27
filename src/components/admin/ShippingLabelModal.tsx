"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
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
} from "lucide-react";
import { getCarrierTrackingUrl } from "@/lib/tracking";

export interface ShippingLabelModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

const BOX_PRESETS = [
  {
    id: "one_cap",
    name: "1 Cap Standard",
    description: "Rigid crown protection",
    length: 8,
    width: 8,
    height: 6,
    weight: 8, // oz
  },
  {
    id: "two_caps",
    name: "2 Caps Double",
    description: "Nested dustbag fit",
    length: 10,
    width: 8,
    height: 6,
    weight: 13, // oz
  },
  {
    id: "three_plus_caps",
    name: "3+ Caps Atelier",
    description: "Luxury master carton",
    length: 12,
    width: 10,
    height: 8,
    weight: 20, // oz
  },
];

export function ShippingLabelModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: ShippingLabelModalProps) {
  const getRates = useAction(api.shipping.getShippingRates);
  const buyLabel = useAction(api.shipping.buyShippingLabel);

  // Box preset & custom dimensions state
  const totalCaps = useMemo(() => {
    if (!order?.items) return 1;
    return order.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);
  }, [order?.items]);

  const defaultPresetId = totalCaps <= 1 ? "one_cap" : totalCaps === 2 ? "two_caps" : "three_plus_caps";
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPresetId);

  const [dimensions, setDimensions] = useState({
    length: 8,
    width: 8,
    height: 6,
    weight: 8,
    unit: "in",
  });

  const [labelFormat, setLabelFormat] = useState<"PDF_4x6" | "PDF">("PDF_4x6");

  // Rates query state
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

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
    const preset = BOX_PRESETS.find((p) => p.id === selectedPresetId);
    if (preset) {
      setDimensions({
        length: preset.length,
        width: preset.width,
        height: preset.height,
        weight: preset.weight,
        unit: "in",
      });
    }
  }, [selectedPresetId]);

  // Reset or initialize state when order opens
  useEffect(() => {
    if (!isOpen || !order) {
      setRates([]);
      setSelectedRateId(null);
      setRateError(null);
      setPurchasedLabel(null);
      setPurchaseError(null);
      return;
    }

    // If order already has a shipping label, populate it
    if (order.shippingLabelUrl && order.trackingNumber) {
      setPurchasedLabel({
        trackingNumber: order.trackingNumber,
        labelUrl: order.shippingLabelUrl,
        carrier: order.carrier || order.shippingCarrier || "Carrier",
        serviceLevel: order.shippingServiceLevel,
      });
    } else {
      setPurchasedLabel(null);
      setSelectedPresetId(defaultPresetId);
      const preset = BOX_PRESETS.find((p) => p.id === defaultPresetId) || BOX_PRESETS[0];
      const initialDims = {
        length: preset.length,
        width: preset.width,
        height: preset.height,
        weight: preset.weight,
        unit: "in",
      };
      setDimensions(initialDims);
      fetchRatesForOrder(order._id, initialDims);
    }
  }, [isOpen, order?._id]);

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
        // Default to cheapest rate or first rate
        const cheapest = res.rates.find((r) => r.isCheapest) || res.rates[0];
        setSelectedRateId(cheapest.objectId);
      } else {
        setRates([]);
        setRateError("No carrier rates available for this destination.");
      }
    } catch (err: any) {
      console.error("Failed to fetch shipping rates:", err);
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
            `Shipping label purchased! Tracking ${res.trackingNumber} assigned via ${res.carrier}. Customer dispatch email sent.`
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
                  Multi-Carrier Shipping & Labels
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
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm">
                #{order.orderNumber}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300">
                {order.items?.length || 1} {order.items?.length === 1 ? "Item" : "Items"} ({totalCaps} {totalCaps === 1 ? "Cap" : "Caps"})
              </span>
            </div>
            <div className="text-zinc-400 text-xs mt-1">
              Recipient: <strong className="text-zinc-200">{order.customerName || "Customer"}</strong> •{" "}
              {order.shippingAddress ? (
                <span>
                  {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
                </span>
              ) : (
                <span className="text-red-400">No destination address specified</span>
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
                  Calibrated for structured cap crowns
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {BOX_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/50 text-white shadow-sm shadow-amber-500/10"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{preset.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-1">
                        {preset.length}&quot; × {preset.width}&quot; × {preset.height}&quot; • {preset.weight} oz
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Dimensions Collapsible */}
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPresetId(selectedPresetId === "custom" ? defaultPresetId : "custom")}
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
                    return (
                      <div
                        key={rate.objectId}
                        onClick={() => setSelectedRateId(rate.objectId)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/60 shadow-md shadow-amber-500/5"
                            : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-amber-400 bg-amber-400"
                                : "border-zinc-600 bg-transparent"
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">
                                {rate.serviceName}
                              </span>

                              {rate.isCheapest && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  <DollarSign className="w-2.5 h-2.5" /> Cheapest
                                </span>
                              )}
                              {rate.isFastest && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" /> Fastest
                                </span>
                              )}
                              {rate.attributes?.includes("BESTVALUE") && (
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
                          <span className="font-mono font-bold text-sm text-emerald-400">
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
