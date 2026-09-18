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
} from "lucide-react";

export default function AdminProductsPage() {
  const t = useTranslations("admin.products");
  const locale = useLocale();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [silhouetteFilter, setSilhouetteFilter] = useState("all");

  // Modal state
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const [isNewVariant, setIsNewVariant] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Quick action feedback
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [feedbackStockId, setFeedbackStockId] = useState<string | null>(null);

  // Convex data & mutations
  const data = useQuery(api.products.getAllProductsAdmin);
  const adjustStock = useMutation(api.products.adjustVariantStock);
  const updatePrice = useMutation(api.products.updateVariantPrice);
  const toggleFeatured = useMutation(api.products.toggleVariantFeatured);
  const saveVariant = useMutation(api.products.saveVariant);
  const deleteVariant = useMutation(api.products.deleteVariant);

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
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setIsNewVariant(true);
    setFormVariantId("");
    setFormNameEn("");
    setFormNameEs("");
    setFormSilhouette("snapback");
    setFormPrimaryHex("#111111");
    setFormSecondaryHex("#ef4444");
    setFormImage("/caps/negro-rojo.png");
    setFormStock(10);
    setFormPriceUsd(120);
    setFormIsFeatured(false);
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
    setFormImage(variant.image);
    setFormStock(variant.stock);
    setFormPriceUsd(variant.priceUsd);
    setFormIsFeatured(Boolean(variant.isFeatured));
    setFormError(null);
    setEditingVariant(variant);
  };

  const handleQuickAdjust = async (variantId: string, delta: number) => {
    try {
      setUpdatingStockId(variantId);
      await adjustStock({ variantId, delta });
      setFeedbackStockId(variantId);
      setTimeout(() => setFeedbackStockId(null), 1500);
    } catch (err) {
      console.error("Failed to adjust stock", err);
    } finally {
      setUpdatingStockId(null);
    }
  };

  const handleToggleFeatured = async (variantId: string) => {
    try {
      await toggleFeatured({ variantId });
    } catch (err) {
      console.error("Failed to toggle featured", err);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVariantId.trim()) return;

    try {
      setIsSaving(true);
      setFormError(null);
      await saveVariant({
        variantId: formVariantId.trim().toLowerCase().replace(/\s+/g, "-"),
        nameEn: formNameEn,
        nameEs: formNameEs,
        silhouette: formSilhouette,
        primaryHex: formPrimaryHex,
        secondaryHex: formSecondaryHex,
        image: formImage,
        stock: Number(formStock),
        priceUsd: Number(formPriceUsd),
        isFeatured: formIsFeatured,
      });
      setEditingVariant(null);
    } catch (err: any) {
      console.error("Failed to save variant", err);
      setFormError(err?.message || "Failed to save variant. Please check inputs.");
    } finally {
      setIsSaving(false);
    }
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
    return matchesSearch && matchesSilhouette;
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSilhouetteFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              silhouetteFilter === "all"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
                : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            All Silhouettes
          </button>
          <button
            onClick={() => setSilhouetteFilter("snapback")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              silhouetteFilter === "snapback"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
                : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Snapback
          </button>
          <button
            onClick={() => setSilhouetteFilter("trucker")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              silhouetteFilter === "trucker"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
                : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Trucker
          </button>
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
                  <th className="py-3 px-4 text-center">Featured</th>
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
                      className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Cap Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 relative overflow-hidden shrink-0 group">
                          <Image
                            src={variant.image}
                            alt={variant.nameEn}
                            fill
                            className="object-contain p-1 group-hover:scale-110 transition-transform"
                          />
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
                              onClick={() => handleQuickAdjust(variant.variantId, -1)}
                              disabled={isUpdating || variant.stock <= 0}
                              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30"
                              title="Deduct 1"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => handleQuickAdjust(variant.variantId, 1)}
                              disabled={isUpdating}
                              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30"
                              title="Add 1"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => handleQuickAdjust(variant.variantId, 5)}
                              disabled={isUpdating}
                              className="px-1.5 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center disabled:opacity-30"
                              title="Add 5"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => handleQuickAdjust(variant.variantId, 10)}
                              disabled={isUpdating}
                              className="px-1.5 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-mono text-xs flex items-center justify-center font-bold"
                              title="Replenish +10"
                            >
                              {isSuccess ? <Check className="w-3 h-3 text-emerald-500" /> : "+10"}
                            </button>
                          </div>
                        </div>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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

              {/* Silhouette & Image */}
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
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    {t("imageUrl")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="/caps/negro-rojo.png"
                    className="w-full py-2 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
                  />
                </div>
              </div>

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

              {/* Featured checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="featuredCheck"
                  checked={formIsFeatured}
                  onChange={(e) => setFormIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded text-moya-red focus:ring-moya-red"
                />
                <label htmlFor="featuredCheck" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  {t("featured")}
                </label>
              </div>

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
                  className="flex-1 py-2.5 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20 disabled:opacity-50"
                >
                  {isSaving ? t("saving") : t("saveVariant")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
