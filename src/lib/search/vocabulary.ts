/**
 * Words Customers use for a category, color or Silhouette, in English and Spanish, already
 * folded by `normalize` (plan 0006). They let "hat" find Caps and "playera negra" find black
 * Heavyweight Tees, and they turn a query into Shop filters. Pure data.
 */
import type { ColorFamily, Silhouette } from "../shop";

export const CAP_WORDS = [
  "cap",
  "caps",
  "hat",
  "hats",
  "headwear",
  "gorra",
  "gorras",
  "cachucha",
  "cachuchas",
  "sombrero",
  "sombreros",
] as const;

export const TEE_WORDS = [
  "tee",
  "tees",
  "tshirt",
  "tshirts",
  "t",
  "shirt",
  "shirts",
  "apparel",
  "playera",
  "playeras",
  "camiseta",
  "camisetas",
  "camisa",
  "camisas",
  "remera",
  "remeras",
] as const;

export const COLOR_WORDS: Record<string, ColorFamily> = {
  black: "black",
  negro: "black",
  negra: "black",
  white: "white",
  blanco: "white",
  blanca: "white",
  grey: "grey",
  gray: "grey",
  gris: "grey",
  cream: "cream",
  crema: "cream",
  beige: "cream",
  brown: "brown",
  cafe: "brown",
  marron: "brown",
  red: "red",
  rojo: "red",
  roja: "red",
  pink: "pink",
  rosa: "pink",
  rosado: "pink",
  rosada: "pink",
  purple: "purple",
  morado: "purple",
  morada: "purple",
  blue: "blue",
  azul: "blue",
  green: "green",
  verde: "green",
};

export const SILHOUETTE_WORDS: Record<string, Silhouette> = {
  snapback: "snapback",
  snapbacks: "snapback",
  trucker: "trucker",
  truckers: "trucker",
  mesh: "trucker",
  malla: "trucker",
};

/** Words too common to narrow a search; dropped from queries that have other words */
export const STOP_WORDS = new Set(["the", "a", "an", "and", "of", "with", "el", "la", "los", "las", "de", "del", "y", "con"]);

const CAP_SET = new Set<string>(CAP_WORDS);
const TEE_SET = new Set<string>(TEE_WORDS);

export function categoryOfWord(word: string): "caps" | "tees" | null {
  if (CAP_SET.has(word)) return "caps";
  if (TEE_SET.has(word)) return "tees";
  return null;
}
