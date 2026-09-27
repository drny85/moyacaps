"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check, ArrowRight, Zap, Filter, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { useSoundEffects } from "@/hooks/useSoundEffects";

export interface SneakerGrail {
  id: string;
  name: string;
  brand: "Jordan" | "Nike" | "adidas" | "New Balance";
  colorway: string;
  paletteHex: [string, string, string]; // Primary, Accent, Neutral
  matchedCapId: string;
  harmonyScore: number; // e.g. 98%
  stylingTipEn: string;
  stylingTipEs: string;
  category: "reds" | "earth" | "blues" | "monochrome" | "green";
}

export const SNEAKER_GRAILS: SneakerGrail[] = [
  {
    id: "jordan-1-chicago",
    name: "Air Jordan 1 Retro High OG 'Chicago'",
    brand: "Jordan",
    colorway: "Varsity Red / Black / White",
    paletteHex: ["#CE1141", "#111111", "#FFFFFF"],
    matchedCapId: "negro-rojo",
    harmonyScore: 99,
    stylingTipEn: "The deep black crown and crimson 3D puff embroidery mirror the Chicago color-blocking with absolute precision.",
    stylingTipEs: "La corona negra profunda y el bordado 3D carmesí reflejan el bloqueo de color Chicago con total fidelidad.",
    category: "reds",
  },
  {
    id: "dunk-medium-olive",
    name: "Nike Dunk Low 'Medium Olive'",
    brand: "Nike",
    colorway: "Medium Olive / White / Black",
    paletteHex: ["#4B5320", "#FFFFFF", "#1E1E1E"],
    matchedCapId: "olivo-dorado",
    harmonyScore: 98,
    stylingTipEn: "Military olive tones meet metallic gold thread highlights, providing the ultimate earthy streetwear elevation.",
    stylingTipEs: "Los tonos olivo militar combinan con el hilo dorado metálico, logrando la máxima estética urbana terrosa.",
    category: "green",
  },
  {
    id: "travis-reverse-mocha",
    name: "Travis Scott x AJ1 Low 'Reverse Mocha'",
    brand: "Jordan",
    colorway: "Sail / Dark Mocha / University Red",
    paletteHex: ["#4A3728", "#F5F5DC", "#C92A2A"],
    matchedCapId: "chocolate-dorado",
    harmonyScore: 97,
    stylingTipEn: "Warm espresso tones paired with champagne gold stitching harmonize seamlessly with the Cactus Jack suede palette.",
    stylingTipEs: "Los tonos espresso cálidos con bordado dorado champán armonizan a la perfección con la gamuza Cactus Jack.",
    category: "earth",
  },
  {
    id: "jordan-4-military-blue",
    name: "Air Jordan 4 Retro 'Military Blue'",
    brand: "Jordan",
    colorway: "Off-White / Military Blue / Neutral Grey",
    paletteHex: ["#0047AB", "#E5E5E5", "#2C2C2C"],
    matchedCapId: "royal-blanco",
    harmonyScore: 98,
    stylingTipEn: "Vibrant royal visor and crisp white relief embroidery create a 1:1 contrast match with the iconic AJ4 eyelets.",
    stylingTipEs: "La visera royal vibrante y el bordado blanco nítido crean un contraste 1:1 con los detalles del clásico AJ4.",
    category: "blues",
  },
  {
    id: "jordan-3-black-cement",
    name: "Air Jordan 3 Retro 'Black Cement'",
    brand: "Jordan",
    colorway: "Black / Fire Red / Cement Grey",
    paletteHex: ["#111111", "#9E9E9E", "#D32F2F"],
    matchedCapId: "negro-gris",
    harmonyScore: 99,
    stylingTipEn: "Monochrome asphalt grey visor paired with a pitch-black crown echoes the legendary elephant print texture.",
    stylingTipEs: "La visera gris asfalto sobre corona negra azabache evoca directamente la textura del legendario elephant print.",
    category: "monochrome",
  },
  {
    id: "adidas-samba-og",
    name: "adidas Samba OG 'Core Black'",
    brand: "adidas",
    colorway: "Core Black / Cloud White / Gum",
    paletteHex: ["#000000", "#FFFFFF", "#C19A6B"],
    matchedCapId: "negro-blanco",
    harmonyScore: 99,
    stylingTipEn: "Clean, timeless black and white dual-tone silhouette with crisp high-density white stitching for the low-profile fit.",
    stylingTipEs: "Silueta atemporal bicolor blanco y negro con bordado blanco de alta densidad para un outfit limpio y minimalista.",
    category: "monochrome",
  },
  {
    id: "new-balance-990v6",
    name: "New Balance 990v6 'Castlerock Grey'",
    brand: "New Balance",
    colorway: "Castlerock Grey / Silver / White",
    paletteHex: ["#7A7D81", "#D8D9DA", "#1F2022"],
    matchedCapId: "gris-negro",
    harmonyScore: 96,
    stylingTipEn: "Heritage Boston athletic grey paired with structured black panels delivers low-key high-craft balance.",
    stylingTipEs: "El gris clásico atlético combinado con paneles negros estructurados aporta un balance de sofisticación discreta.",
    category: "monochrome",
  },
  {
    id: "jordan-1-unc",
    name: "Air Jordan 1 Low 'University Blue'",
    brand: "Jordan",
    colorway: "University Blue / White",
    paletteHex: ["#7BAFD4", "#FFFFFF", "#111111"],
    matchedCapId: "cielo-blanco",
    harmonyScore: 98,
    stylingTipEn: "Powder blue crown and pristine white devil embroidery capture the iconic collegiate aesthetic effortlessly.",
    stylingTipEs: "La corona celeste polvo y el bordado blanco nítido capturan sin esfuerzo la estética colegial legendaria.",
    category: "blues",
  },
];

export function SneakerFitMatcherModal() {
  const locale = useLocale();
  const isEs = locale === "es";
  const router = useRouter();
  const { playClick, playSuccessChime } = useSoundEffects();

  const {
    isSneakerMatcherOpen,
    closeSneakerMatcher,
    sneakerMatcherTargetCap,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSneakerId, setSelectedSneakerId] = useState<string>(
    SNEAKER_GRAILS[0].id
  );

  // If a target cap is provided (e.g. from PDP), prioritize finding its best sneaker match
  const activeSneaker = useMemo(() => {
    if (sneakerMatcherTargetCap) {
      const matchForCap = SNEAKER_GRAILS.find(
        (s) => s.matchedCapId === sneakerMatcherTargetCap.id
      );
      if (matchForCap) return matchForCap;
    }
    return (
      SNEAKER_GRAILS.find((s) => s.id === selectedSneakerId) ||
      SNEAKER_GRAILS[0]
    );
  }, [selectedSneakerId, sneakerMatcherTargetCap]);

  const matchedCap = useMemo(() => {
    return (
      CAP_VARIANTS.find((c) => c.id === activeSneaker.matchedCapId) ||
      CAP_VARIANTS[0]
    );
  }, [activeSneaker]);

  const filteredSneakers = useMemo(() => {
    return SNEAKER_GRAILS.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.colorway.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  if (!isSneakerMatcherOpen) return null;

  const handleSelectCap = (cap: CapVariant) => {
    playSuccessChime();
    closeSneakerMatcher();
    router.push(`/caps/${cap.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-moya-red to-moya-red-deep p-0.5 flex items-center justify-center shadow-lg shadow-moya-red/20 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
                  {isEs ? "ESTUDIO DE ESTILO URBANO" : "STREETWEAR COLOR HARMONY"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-moya-green/15 text-moya-green text-[9px] font-mono font-bold">
                  0880 ATELIER
                </span>
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-zinc-900 dark:text-white">
                {isEs ? "Emparejador de Tenis y Gorras" : "Sneaker & Fit Matcher"}
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              playClick();
              closeSneakerMatcher();
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Split: Left Sneaker Catalog, Right Harmony Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* Left Column: Sneaker Selector */}
          <div className="lg:col-span-6 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-black/[0.08] dark:border-white/[0.08] flex flex-col gap-4 max-h-[550px] overflow-y-auto">
            {/* Search & Category Pills */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isEs
                      ? "Buscar por tenis (Chicago, Olive, Samba...)"
                      : "Search sneakers (Chicago, Mocha, Samba...)"
                  }
                  className="w-full pl-9 pr-4 py-2 rounded-xl glass-dark border border-black/10 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red/50"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-display">
                {[
                  { id: "all", labelEn: "All Grails", labelEs: "Todos" },
                  { id: "reds", labelEn: "Reds & Fire", labelEs: "Rojos" },
                  { id: "green", labelEn: "Olive & Earth", labelEs: "Olivo" },
                  { id: "earth", labelEn: "Mocha Brown", labelEs: "Mocha" },
                  { id: "blues", labelEn: "Royal / UNC", labelEs: "Azules" },
                  { id: "monochrome", labelEn: "Black & White", labelEs: "Bicolor" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      playClick();
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-all font-semibold ${
                      selectedCategory === cat.id
                        ? "bg-moya-red text-white"
                        : "glass-dark text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {isEs ? cat.labelEs : cat.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Sneaker Cards List */}
            <div className="space-y-2">
              {filteredSneakers.map((sneaker) => {
                const isSelected = activeSneaker.id === sneaker.id;
                return (
                  <button
                    key={sneaker.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setSelectedSneakerId(sneaker.id);
                    }}
                    className={`w-full p-3 rounded-2xl text-left transition-all border flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-moya-red/10 border-moya-red ring-2 ring-moya-red/20 shadow-md"
                        : "glass-dark border-black/[0.06] dark:border-white/[0.06] hover:border-black/15 dark:hover:border-white/15"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-moya-red">
                          {sneaker.brand}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {sneaker.colorway}
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                        {sneaker.name}
                      </h4>
                      {/* Palette Dots */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {sneaker.paletteHex.map((hex, i) => (
                          <span
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-xs"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-moya-green/15 text-moya-green text-xs font-mono font-bold">
                        <Zap className="w-3 h-3" />
                        {sneaker.harmonyScore}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Match Card & Styling Verdict */}
          <div className="lg:col-span-6 p-4 sm:p-6 bg-zinc-50 dark:bg-[#08080c] flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Harmony Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-moya-red/10 via-moya-violet/10 to-moya-green/10 border border-black/10 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold">
                    {isEs ? "ÍNDICE DE ARMONÍA CROMÁTICA" : "CHROMATIC HARMONY INDEX"}
                  </span>
                  <div className="text-2xl font-display font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>{activeSneaker.harmonyScore}% MATCH</span>
                    <span className="text-sm font-sans font-normal text-emerald-500">
                      ✦ Verified Fit
                    </span>
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-display font-black text-base shadow-lg">
                  ☘
                </div>
              </div>

              {/* Matched Cap Showcase */}
              <div className="relative p-5 rounded-3xl glass-dark border border-black/10 dark:border-white/10 flex flex-col items-center text-center">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                  <Image
                    src={matchedCap.image}
                    alt={matchedCap.nameEn}
                    fill
                    className="object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.35)]"
                  />
                </div>

                <div className="mt-2 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-moya-red font-bold">
                    {isEs ? "GORRA RECOMENDADA" : "RECOMMENDED COMPANION CAP"}
                  </span>
                  <h4 className="text-lg font-display font-black text-zinc-900 dark:text-white">
                    {isEs ? matchedCap.nameEs : matchedCap.nameEn}
                  </h4>
                  <p className="text-xs font-mono text-zinc-500">
                    ${matchedCap.priceUsd} USD • {matchedCap.silhouette}
                  </p>
                </div>

                {/* Color Swatch Comparison Row */}
                <div className="mt-4 flex items-center gap-3 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[11px] font-mono">
                  <span className="text-zinc-500">{isEs ? "Tenis:" : "Kicks:"}</span>
                  <div className="flex items-center gap-1">
                    {activeSneaker.paletteHex.map((hex, i) => (
                      <span
                        key={i}
                        className="w-3.5 h-3.5 rounded-full border border-white/30"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <span className="text-zinc-400">↔</span>
                  <span className="text-zinc-500">{isEs ? "Gorra:" : "Cap:"}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30"
                      style={{ backgroundColor: matchedCap.primaryHex }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30"
                      style={{ backgroundColor: matchedCap.secondaryHex }}
                    />
                  </div>
                </div>
              </div>

              {/* Styling Tip Rationale */}
              <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                  {isEs ? "VEREDICTO DEL ESTILISTA" : "STYLING VERDICT"}
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {isEs ? activeSneaker.stylingTipEs : activeSneaker.stylingTipEn}
                </p>
              </div>
            </div>

            {/* Action Call to Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSelectCap(matchedCap)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-moya-red via-moya-red-deep to-moya-red text-white font-display font-bold text-xs uppercase tracking-wider shadow-lg shadow-moya-red/25 hover:shadow-xl hover:shadow-moya-red/35 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>{isEs ? "Ver Esta Gorra en Detalle" : "Inspect & Claim This Cap"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
