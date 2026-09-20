"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Plus,
  Layers,
  Sparkles,
  Edit2,
  Trash2,
  Check,
  RotateCw,
  ExternalLink,
  Search,
  Star,
  DollarSign,
  AlertTriangle,
  X,
  Eye,
  Sliders,
  Upload,
  Image as ImageIcon,
  Loader2,
  EyeOff,
  Radio,
  Bell,
  Users,
  Clock,
  Calendar,
} from "lucide-react";
import StockConfirmDialog, { StockConfirmTarget } from "@/components/admin/StockConfirmDialog";
import AvailabilityConfirmDialog, { AvailabilityConfirmTarget } from "@/components/admin/AvailabilityConfirmDialog";
import { DropScheduleDialog, DropScheduleTarget } from "@/components/admin/DropScheduleDialog";
import { DateTimePicker } from "@/components/admin/DateTimePicker";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export default function AdminProductsPage() {
  const t = useTranslations("admin.products");
  const locale = useLocale();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [silhouetteFilter, setSilhouetteFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  // Modal state
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  useLockBodyScroll(Boolean(editingVariant));
  const [isNewVariant, setIsNewVariant] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Stock Confirmation Safeguard State
  const [stockConfirmTarget, setStockConfirmTarget] = useState<StockConfirmTarget | null>(null);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  // Availability Confirmation Safeguard State
  const [availabilityConfirmTarget, setAvailabilityConfirmTarget] = useState<AvailabilityConfirmTarget | null>(null);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  // Drop Schedule Dialog State
  const [dropScheduleTarget, setDropScheduleTarget] = useState<DropScheduleTarget | null>(null);
  const [isSavingDropSchedule, setIsSavingDropSchedule] = useState(false);

  // Quick action feedback
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [feedbackStockId, setFeedbackStockId] = useState<string | null>(null);

  // Convex data & mutations
  const data = useQuery(api.products.getAllProductsAdmin);
  const adjustStock = useMutation(api.products.adjustVariantStock);
  const updatePrice = useMutation(api.products.updateVariantPrice);
  const toggleFeatured = useMutation(api.products.toggleVariantFeatured);
  const toggleAvailable = useMutation(api.products.toggleVariantAvailable);
  const saveVariant = useMutation(api.products.saveVariant);
  const deleteVariant = useMutation(api.products.deleteVariant);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const updateVariantDropStatus = useMutation(api.products.updateVariantDropStatus);

  // Form state for Modal
  const [formVariantId, setFormVariantId] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formNameEs, setFormNameEs] = useState("");
  const [formSilhouette, setFormSilhouette] = useState("snapback");
  const [formPrimaryHex, setFormPrimaryHex] = useState("#111111");
  const [formSecondaryHex, setFormSecondaryHex] = useState("#ef4444");
  const [formImage, setFormImage] = useState("/caps/negro-rojo.png");
  const [formStock, setFormStock] = useState(12);
  const [formPriceUsd, setFormPriceUsd] = useState(120);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formIsDrop, setFormIsDrop] = useState(false);
  const [formDropTimestamp, setFormDropTimestamp] = useState<number>(Date.now() + 86400000 * 3);
  const [formDropBadgeTextEn, setFormDropBadgeTextEn] = useState("");
  const [formDropBadgeTextEs, setFormDropBadgeTextEs] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storageId, setStorageId] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormError("Please upload a valid image file (PNG, WebP, JPG, or SVG).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setFormError("Image file size exceeds 12MB limit.");
      return;
    }
    setFormError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const openCreateModal = () => {
    setIsNewVariant(true);
    setFormVariantId("");
    setFormNameEn("");
    setFormNameEs("");
    setFormSilhouette("snapback");
    setFormPrimaryHex("#111111");
    setFormSecondaryHex("#ef4444");
    setFormImage("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setStorageId(null);
    setImageMode("upload");
    setUploadProgress(null);
    setFormStock(10);
    setFormPriceUsd(120);
    setFormIsFeatured(false);
    setFormIsAvailable(true);
    setFormIsDrop(false);
    setFormDropTimestamp(Date.now() + 86400000 * 3);
    setFormDropBadgeTextEn("");
    setFormDropBadgeTextEs("");
    setFormError(null);
    setEditingVariant(true);
  };

  const openEditModal = (variant: any) => {
    setIsNewVariant(false);
    setFormVariantId(variant.variantId);
    setFormNameEn(variant.nameEn);
    setFormNameEs(variant.nameEs);
    setFormSilhouette(variant.silhouette);
    setFormPrimaryHex(variant.primaryHex);
    setFormSecondaryHex(variant.secondaryHex);
    setFormImage(variant.image || "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setStorageId(variant.storageId || null);
    setImageMode("upload");
    setUploadProgress(null);
    setFormStock(variant.stock);
    setFormPriceUsd(variant.priceUsd);
    setFormIsFeatured(Boolean(variant.isFeatured));
    setFormIsAvailable(variant.isAvailable !== false);
    setFormIsDrop(Boolean(variant.isDrop));
    setFormDropTimestamp(variant.dropDate || Date.now() + 86400000 * 3);
    setFormDropBadgeTextEn(variant.dropBadgeTextEn || "");
    setFormDropBadgeTextEs(variant.dropBadgeTextEs || "");
    setFormError(null);
    setEditingVariant(variant);
  };

  const openDropScheduleDialog = (variant: any) => {
    setDropScheduleTarget({
      variantId: variant.variantId,
      name: locale === "es" ? variant.nameEs : variant.nameEn,
      silhouette: variant.silhouette,
      image: variant.image,
      primaryHex: variant.primaryHex,
      secondaryHex: variant.secondaryHex,
      isDrop: Boolean(variant.isDrop),
      dropDate: variant.dropDate,
      dropBadgeTextEn: variant.dropBadgeTextEn,
      dropBadgeTextEs: variant.dropBadgeTextEs,
      subscribersCount: variant.subscribersCount,
    });
  };

  const handleSaveDropSchedule = async (args: {
    variantId: string;
    isDrop: boolean;
    dropDate?: number;
    dropBadgeTextEn?: string;
    dropBadgeTextEs?: string;
  }) => {
    try {
      setIsSavingDropSchedule(true);
      await updateVariantDropStatus(args);
      setDropScheduleTarget(null);
    } catch (err: any) {
      console.error("Failed to update drop schedule", err);
    } finally {
      setIsSavingDropSchedule(false);
    }
  };

  const requestQuickAdjust = (variant: any, delta: number) => {
    const newStock = Math.max(0, variant.stock + delta);
    setStockConfirmTarget({
      variantId: variant.variantId,
      name: locale === "es" ? variant.nameEs : variant.nameEn,
      silhouette: variant.silhouette,
      image: variant.image,
      primaryHex: variant.primaryHex,
      secondaryHex: variant.secondaryHex,
      currentStock: variant.stock,
      newStock,
      delta,
    });
  };

  const handleConfirmStockAction = async () => {
    if (!stockConfirmTarget) return;

    if (editingVariant) {
      setStockConfirmTarget(null);
      await executeSaveVariant();
    } else {
      try {
        setIsAdjustingStock(true);
        setUpdatingStockId(stockConfirmTarget.variantId);
        await adjustStock({
          variantId: stockConfirmTarget.variantId,
          delta: stockConfirmTarget.delta,
        });
        setFeedbackStockId(stockConfirmTarget.variantId);
        setTimeout(() => setFeedbackStockId(null), 1500);
        setStockConfirmTarget(null);
      } catch (err: any) {
        console.error("Failed to adjust stock", err);
        setFormError(err?.message || "Failed to adjust stock");
      } finally {
        setIsAdjustingStock(false);
        setUpdatingStockId(null);
      }
    }
  };

  const handleToggleFeatured = async (variantId: string) => {
    try {
      await toggleFeatured({ variantId });
    } catch (err) {
      console.error("Failed to toggle featured", err);
    }
  };

  const requestToggleAvailability = (variant: any) => {
    const currentAvailable = variant.isAvailable !== false;
    setAvailabilityConfirmTarget({
      variantId: variant.variantId,
      name: locale === "es" ? variant.nameEs : variant.nameEn,
      silhouette: variant.silhouette,
      image: variant.image,
      currentAvailable,
      newAvailable: !currentAvailable,
    });
  };

  const handleConfirmAvailability = async () => {
    if (!availabilityConfirmTarget) return;
    setIsTogglingAvailability(true);
    try {
      await toggleAvailable({
        variantId: availabilityConfirmTarget.variantId,
        isAvailable: availabilityConfirmTarget.newAvailable,
      });
      setAvailabilityConfirmTarget(null);
    } catch (err) {
      console.error("Failed to toggle variant availability", err);
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const executeSaveVariant = async () => {
    try {
      setIsSaving(true);
      setFormError(null);

      let finalStorageId = storageId;
      let finalImageUrl = formImage.trim();

      // If a new local file was selected, upload it directly to Convex Storage
      if (selectedFile) {
        setUploadProgress("Uploading cap image to Convex storage...");
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image file to Convex storage.");
        }

        const uploadData = await uploadRes.json();
        finalStorageId = uploadData.storageId;
      }

      // If in URL mode and no new file was uploaded, clear storageId so the custom URL is prioritized
      if (imageMode === "url" && !selectedFile) {
        finalStorageId = null;
      }

      setUploadProgress("Saving product details...");
      await saveVariant({
        variantId: formVariantId.trim().toLowerCase().replace(/\s+/g, "-"),
        nameEn: formNameEn,
        nameEs: formNameEs,
        silhouette: formSilhouette,
        primaryHex: formPrimaryHex,
        secondaryHex: formSecondaryHex,
        image: finalImageUrl,
        storageId: finalStorageId ? (finalStorageId as any) : undefined,
        stock: Number(formStock),
        priceUsd: Number(formPriceUsd),
        isFeatured: formIsFeatured,
        isAvailable: formIsAvailable,
        isDrop: formIsDrop,
        dropDate: formIsDrop ? formDropTimestamp : undefined,
        dropBadgeTextEn: formDropBadgeTextEn.trim() || undefined,
        dropBadgeTextEs: formDropBadgeTextEs.trim() || undefined,
      });

      setEditingVariant(null);
    } catch (err: any) {
      console.error("Failed to save variant", err);
      setFormError(err?.message || "Failed to save variant. Please check inputs.");
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVariantId.trim()) return;

    // High-Friction Safeguard: If stock is changing in the edit modal, prompt confirmation first
    if (!isNewVariant && editingVariant && editingVariant.stock !== Number(formStock)) {
      const delta = Number(formStock) - editingVariant.stock;
      setStockConfirmTarget({
        variantId: editingVariant.variantId,
        name: locale === "es" ? formNameEs : formNameEn,
        silhouette: formSilhouette,
        image: previewUrl || formImage || editingVariant.image,
        primaryHex: formPrimaryHex,
        secondaryHex: formSecondaryHex,
        currentStock: editingVariant.stock,
        newStock: Number(formStock),
        delta,
      });
      return;
    }

    await executeSaveVariant();
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await deleteVariant({ variantId });
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete variant", err);
    }
  };

  const variants = data?.variants || [];
  const filteredVariants = variants.filter((v) => {
    const matchesSearch =
      v.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.nameEs.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.variantId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSilhouette = silhouetteFilter === "all" || v.silhouette === silhouetteFilter;
    const isAvailable = v.isAvailable !== false;
    const matchesAvailability =
      availabilityFilter === "all" ||
      (availabilityFilter === "available" && isAvailable) ||
      (availabilityFilter === "unavailable" && !isAvailable);
    return matchesSearch && matchesSilhouette && matchesAvailability;
  });

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
            Catalog & Inventory Studio
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t("addColorway")}</span>
          </button>
        </div>
      </div>

      {/* ── Metric Highlights Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400 block">
            Colorways Total
          </span>
          <span className="text-xl font-display font-bold text-zinc-900 dark:text-white mt-1 block">
            {variants.length}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400 block">
            Inventory Units
          </span>
          <span className="text-xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {totalStock} pcs
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400 block">
            Snapback / Trucker
          </span>
          <span className="text-xl font-display font-bold text-zinc-900 dark:text-white mt-1 block">
            {variants.filter((v) => v.silhouette === "snapback").length} / {variants.filter((v) => v.silhouette === "trucker").length}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400 block">
            Featured Drops
          </span>
          <span className="text-xl font-display font-bold text-amber-500 mt-1 block">
            {variants.filter((v) => v.isFeatured).length}
          </span>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search colorways by name or slug..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Silhouette Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/80 dark:bg-white/[0.04]">
            <button
              onClick={() => setSilhouetteFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                silhouetteFilter === "all"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All Silhouettes
            </button>
            <button
              onClick={() => setSilhouetteFilter("snapback")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                silhouetteFilter === "snapback"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Snapback
            </button>
            <button
              onClick={() => setSilhouetteFilter("trucker")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                silhouetteFilter === "trucker"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Trucker
            </button>
          </div>

          {/* Availability Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/80 dark:bg-white/[0.04]">
            <button
              onClick={() => setAvailabilityFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                availabilityFilter === "all"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {t("filterAllStatus")}
            </button>
            <button
              onClick={() => setAvailabilityFilter("available")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                availabilityFilter === "available"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{t("filterAvailableOnly")}</span>
            </button>
            <button
              onClick={() => setAvailabilityFilter("unavailable")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                availabilityFilter === "unavailable"
                  ? "bg-amber-600 text-white font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400"
              }`}
            >
              <EyeOff className="w-3 h-3" />
              <span>{t("filterUnavailableOnly")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Colorways Table ── */}
      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-xs">
        {!data ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-600 dark:text-zinc-400 animate-pulse">
            Loading catalog data...
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="p-12 text-center text-zinc-600 dark:text-zinc-400 text-xs">
            No colorways match your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.02] text-zinc-600 dark:text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Cap</th>
                  <th className="py-3 px-4">Colorway (EN / ES)</th>
                  <th className="py-3 px-4">Palette</th>
                  <th className="py-3 px-4">Silhouette</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock & Quick Restock</th>
                  <th className="py-3 px-4 text-center">{t("availability")}</th>
                  <th className="py-3 px-4 text-center">Featured</th>
                  <th className="py-3 px-4 text-center">VIP Drop Radar</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {filteredVariants.map((variant) => {
                  const isUpdating = updatingStockId === variant.variantId;
                  const isSuccess = feedbackStockId === variant.variantId;

                  return (
                    <tr
                      key={variant.variantId}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                        variant.isAvailable === false ? "bg-zinc-50/40 dark:bg-white/[0.01] opacity-75" : ""
                      }`}
                    >
                      {/* Cap Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 relative overflow-hidden shrink-0 group">
                          <Image
                            src={variant.image || "/caps/negro-rojo.png"}
                            alt={variant.nameEn}
                            fill
                            sizes="48px"
                            className={`object-contain p-1 group-hover:scale-110 transition-transform ${
                              variant.isAvailable === false ? "grayscale opacity-50" : ""
                            }`}
                          />
                          {variant.isAvailable === false && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none" title={t("notAvailable")}>
                              <EyeOff className="w-4 h-4 text-amber-400" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Names & ID */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-zinc-900 dark:text-white block">
                          {variant.nameEn}
                        </span>
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block">
                          {variant.nameEs}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 block mt-0.5">
                          slug: {variant.variantId}
                        </span>
                      </td>

                      {/* Color Palette Swatches */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div
                            style={{ backgroundColor: variant.primaryHex }}
                            className="w-5 h-5 rounded-full border border-black/20 shadow-xs"
                            title={`Crown: ${variant.primaryHex}`}
                          />
                          <div
                            style={{ backgroundColor: variant.secondaryHex }}
                            className="w-5 h-5 rounded-full border border-black/20 shadow-xs"
                            title={`Visor: ${variant.secondaryHex}`}
                          />
                        </div>
                      </td>

                      {/* Silhouette */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                          {variant.silhouette}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        ${variant.priceUsd} <span className="text-[10px] text-zinc-600 dark:text-zinc-400">USD</span>
                      </td>

                      {/* Stock Level & Quick Adjust */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                              variant.stock === 0
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : variant.stock <= 5
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {variant.stock} left
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => requestQuickAdjust(variant, -1)}
                              disabled={isUpdating || variant.stock <= 0}
                              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30 transition-colors"
                              title="Deduct 1"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => requestQuickAdjust(variant, 1)}
                              disabled={isUpdating}
                              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30 transition-colors"
                              title="Add 1"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => requestQuickAdjust(variant, 5)}
                              disabled={isUpdating}
                              className="px-1.5 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30 transition-colors"
                              title="Add 5"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => requestQuickAdjust(variant, 10)}
                              disabled={isUpdating}
                              className="px-1.5 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-mono text-xs flex items-center justify-center font-bold hover:opacity-90 transition-opacity"
                              title="Replenish +10"
                            >
                              {isSuccess ? <Check className="w-3 h-3 text-emerald-500" /> : "+10"}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Availability Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => requestToggleAvailability(variant)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            variant.isAvailable !== false
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"
                          }`}
                          title={variant.isAvailable !== false ? "Click to mark as Not Available" : "Click to mark as Available"}
                        >
                          {variant.isAvailable !== false ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t("available")}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>{t("notAvailable")}</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Featured Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleFeatured(variant.variantId)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            variant.isFeatured
                              ? "text-amber-500 bg-amber-500/10"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-amber-500"
                          }`}
                          title="Toggle Hero / Featured Showcase"
                        >
                          <Star className={`w-4 h-4 ${variant.isFeatured ? "fill-amber-500" : ""}`} />
                        </button>
                      </td>

                      {/* VIP Drop Radar */}
                      <td className="py-3 px-4 text-center">
                        {variant.isDrop ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openDropScheduleDialog(variant)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-moya-red/15 text-moya-red border border-moya-red/30 hover:bg-moya-red/25 transition-all shadow-xs cursor-pointer"
                              title="Configure VIP Drop Radar"
                            >
                              <Radio className="w-3 h-3 animate-pulse text-moya-red" />
                              <span>RADAR ON</span>
                            </button>
                            {variant.dropDate && (
                              <span className="text-[10px] font-mono text-zinc-500">
                                {new Date(variant.dropDate).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Users className="w-2.5 h-2.5" />
                              <span>{variant.subscribersCount || 0} VIPs</span>
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDropScheduleDialog(variant)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Schedule as VIP Drop"
                          >
                            <Bell className="w-3 h-3" />
                            <span>+ Drop</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(variant)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                            title="Edit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <Link
                            href={`/caps/${variant.variantId}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                            title="Preview on live store"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => setDeleteConfirmId(variant.variantId)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── Modal: Add / Edit Colorway ── */}
      {editingVariant && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
          style={{ overscrollBehavior: "contain" }}
        >
          <div
            data-lenis-prevent
            className="max-w-xl w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain"
            style={{ overscrollBehavior: "contain" }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
              <div>
                <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                  {isNewVariant ? t("addColorway") : t("editColorway")}
                </h3>
                <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                  0880 Good Luck Signature Roster
                </span>
              </div>
              <button
                onClick={() => setEditingVariant(null)}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-between text-xs">
                  <span>{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Variant ID / Slug */}
              <div>
                <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                  {t("variantId")}
                </label>
                <input
                  type="text"
                  required
                  disabled={!isNewVariant}
                  value={formVariantId}
                  onChange={(e) => setFormVariantId(e.target.value)}
                  placeholder="e.g. negro-oro"
                  className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red disabled:opacity-60"
                />
              </div>

              {/* Names EN & ES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("colorwayNameEn")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g. Black / Gold Flare"
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("colorwayNameEs")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNameEs}
                    onChange={(e) => setFormNameEs(e.target.value)}
                    placeholder="e.g. Negro / Oro Edición"
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>
              </div>

              {/* Silhouette & Image Mode Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("silhouette")}
                  </label>
                  <select
                    value={formSilhouette}
                    onChange={(e) => setFormSilhouette(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red"
                  >
                    <option value="snapback">{t("snapback")}</option>
                    <option value="trucker">{t("trucker")}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-zinc-700 dark:text-zinc-300">
                      Cap Image Source
                    </label>
                    <div className="flex items-center rounded-lg bg-zinc-100 dark:bg-white/[0.05] p-0.5 text-[10px] font-medium">
                      <button
                        type="button"
                        onClick={() => setImageMode("upload")}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          imageMode === "upload"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode("url")}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          imageMode === "url"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Path / URL
                      </button>
                    </div>
                  </div>

                  {imageMode === "url" ? (
                    <input
                      type="text"
                      required={imageMode === "url"}
                      value={formImage}
                      onChange={(e) => {
                        setFormImage(e.target.value);
                        setPreviewUrl(e.target.value);
                      }}
                      placeholder="/caps/negro-rojo.png or https://..."
                      className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                    />
                  ) : (
                    <div className="text-[11px] text-zinc-500 py-2">
                      Upload directly to Convex Storage below.
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Dropzone & Preview (when in Upload mode) */}
              {imageMode === "upload" && (
                <div className="space-y-2">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block">
                    Product Showcase Image
                  </label>

                  {previewUrl ? (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
                      <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 relative overflow-hidden shrink-0">
                        <Image
                          src={previewUrl}
                          alt="Cap Preview"
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-white truncate block">
                            {selectedFile ? selectedFile.name : (storageId ? "Stored in Convex Storage" : formImage || "Cap Image")}
                          </span>
                          {storageId && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Convex Storage
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 block mt-0.5">
                          {selectedFile
                            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                            : "Ready for live store display"}
                        </span>
                      </div>

                      <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors shrink-0">
                        <span>Change</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setStorageId(null);
                          setFormImage("");
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files?.[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`cursor-pointer flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all ${
                        isDragging
                          ? "border-moya-red bg-moya-red/5"
                          : "border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 bg-zinc-50/50 dark:bg-white/[0.01]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-zinc-900 dark:text-white text-center">
                        Click to browse or drag & drop cap image
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-1 text-center">
                        PNG, WebP, JPG up to 12MB (Transparent background recommended)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Hex Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("primaryHex")}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formPrimaryHex}
                      onChange={(e) => setFormPrimaryHex(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={formPrimaryHex}
                      onChange={(e) => setFormPrimaryHex(e.target.value)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 font-mono text-zinc-900 dark:text-white uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("secondaryHex")}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formSecondaryHex}
                      onChange={(e) => setFormSecondaryHex(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={formSecondaryHex}
                      onChange={(e) => setFormSecondaryHex(e.target.value)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 font-mono text-zinc-900 dark:text-white uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("priceUsd")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPriceUsd}
                    onChange={(e) => setFormPriceUsd(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("stock")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>
              </div>

              {/* Availability & Featured toggles */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
                  <input
                    type="checkbox"
                    id="availableCheck"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
                  />
                  <label htmlFor="availableCheck" className="flex-1 cursor-pointer">
                    <span className="font-semibold text-zinc-900 dark:text-white block text-xs">
                      {t("availableSwitch")}
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      {t("availableSwitchDesc")}
                    </span>
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                      formIsAvailable
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {formIsAvailable ? t("available") : t("notAvailable")}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    id="featuredCheck"
                    checked={formIsFeatured}
                    onChange={(e) => setFormIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
                  />
                  <label htmlFor="featuredCheck" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer text-xs">
                    {t("featured")}
                  </label>
                </div>

                {/* VIP Drop Radar Scheduling */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isDropCheck"
                      checked={formIsDrop}
                      onChange={(e) => setFormIsDrop(e.target.checked)}
                      className="w-4 h-4 rounded text-moya-red focus:ring-moya-red cursor-pointer"
                    />
                    <label htmlFor="isDropCheck" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-moya-red" />
                        <span className="font-semibold text-zinc-900 dark:text-white block text-xs">
                          Schedule as Limited Drop (VIP Radar)
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 block">
                        Activates live countdown ticker, collects waitlist alerts, and gates purchases until drop date.
                      </span>
                    </label>
                  </div>

                  {formIsDrop && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-white/10 space-y-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                          Release Target (Date & Time)
                        </label>
                        <DateTimePicker
                          value={formDropTimestamp}
                          onChange={(newTimestamp) => setFormDropTimestamp(newTimestamp)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                            Drop Badge (EN)
                          </label>
                          <input
                            type="text"
                            value={formDropBadgeTextEn}
                            onChange={(e) => setFormDropBadgeTextEn(e.target.value)}
                            placeholder="e.g. Vault Release 01"
                            className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                            Drop Badge (ES)
                          </label>
                          <input
                            type="text"
                            value={formDropBadgeTextEs}
                            onChange={(e) => setFormDropBadgeTextEs(e.target.value)}
                            placeholder="ej. Lanzamiento de Bóveda"
                            className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {uploadProgress && (
                <div className="p-2.5 rounded-xl bg-moya-red/10 border border-moya-red/20 text-moya-red flex items-center gap-2 text-xs font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? (uploadProgress ? "Uploading & Saving..." : t("saving")) : t("saveVariant")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Stock & Quick Restock Confirmation Safeguard ── */}
      <StockConfirmDialog
        target={stockConfirmTarget}
        isOpen={Boolean(stockConfirmTarget)}
        onClose={() => setStockConfirmTarget(null)}
        onConfirm={handleConfirmStockAction}
        isProcessing={isAdjustingStock || isSaving}
      />

      {/* ── Modal: Availability Confirmation Safeguard ── */}
      <AvailabilityConfirmDialog
        target={availabilityConfirmTarget}
        isOpen={Boolean(availabilityConfirmTarget)}
        onClose={() => setAvailabilityConfirmTarget(null)}
        onConfirm={handleConfirmAvailability}
        isProcessing={isTogglingAvailability}
      />

      {/* ── Modal: VIP Drop Radar Schedule Dialog ── */}
      <DropScheduleDialog
        target={dropScheduleTarget}
        isOpen={Boolean(dropScheduleTarget)}
        onClose={() => setDropScheduleTarget(null)}
        onSave={handleSaveDropSchedule}
        isProcessing={isSavingDropSchedule}
      />

      {/* ── Modal: Delete Confirmation ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-red-500/20 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
              Delete Colorway
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {t("deleteConfirm")} Colorway slug: <span className="font-mono font-bold text-zinc-900 dark:text-white">{deleteConfirmId}</span>
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Keep Colorway
              </button>
              <button
                onClick={() => handleDeleteVariant(deleteConfirmId)}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-md shadow-red-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
