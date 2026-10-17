import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CapVariant } from "@/data/caps";
import { backfillTeeColorways } from "@/lib/cartMigration";

export interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  priceUsd: number;
  image: string;
  silhouette: string;
  quantity: number;
  maxStock?: number;
  size?: string;
  colorway?: string;
  colorwayName?: string;
}

/** The slice of the store saved to localStorage (see `partialize`). */
type PersistedState = Pick<StoreState, "cart" | "currency" | "theme" | "soundEnabled" | "tryOnImage" | "tryOnSettings">;

interface StoreState {
  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (
    cap: CapVariant,
    quantity?: number,
    maxStock?: number,
    size?: string,
    colorway?: string,
    colorwayName?: string,
    customImage?: string
  ) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number, maxStock?: number) => void;
  clampCartToStock: (variants: {
    variantId: string;
    stock: number;
    nameEn?: string;
    isAvailable?: boolean;
    isDrop?: boolean;
    dropDate?: number;
    dropStatus?: string;
  }[]) => {
    adjusted: boolean;
    adjustedNames: string[];
  };
  clearCart: () => void;

  // Currency (USD only)
  currency: "USD";
  setCurrency: (currency: "USD") => void;

  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;

  // Quick View Modal
  quickViewCap: CapVariant | null;
  openQuickView: (cap: CapVariant) => void;
  closeQuickView: () => void;

  // Drop Alert Modal
  dropAlertCap: CapVariant | null;
  openDropAlert: (cap: CapVariant) => void;
  closeDropAlert: () => void;

  // Sound Effects (Web Audio)
  soundEnabled: boolean;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;

  // Virtual Try-On Fitting Room
  isTryOnOpen: boolean;
  tryOnTargetCap: CapVariant | null;
  tryOnImage: string | null;
  tryOnSettings: { offsetX: number; offsetY: number; scale: number; tilt: number; tiltX: number };
  openTryOn: (cap?: CapVariant | null) => void;
  closeTryOn: () => void;
  setTryOnImage: (img: string | null) => void;
  setTryOnSettings: (settings: { offsetX: number; offsetY: number; scale: number; tilt: number; tiltX: number }) => void;

  // Share Notification Toast
  shareToast: {
    isOpen: boolean;
    capName: string;
    url: string;
    capImage: string;
  } | null;
  showShareToast: (data: { capName: string; url: string; capImage: string }) => void;
  hideShareToast: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      isCartOpen: false,
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
      toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),

      addToCart: (cap, quantity = 1, maxStock?: number, size?: string, colorway?: string, colorwayName?: string, customImage?: string) => {
        // Enforce strict drop lock: cannot add drops to cart if not released yet
        const isUpcomingDrop = Boolean(
          cap.isDrop &&
          cap.dropStatus !== "live" &&
          ((typeof cap.dropDate === "number" && Date.now() < cap.dropDate) || cap.dropStatus === "scheduled")
        );
        if (isUpcomingDrop) {
          return;
        }

        const { cart } = get();
        const cartItemId = `${cap.id}${colorway ? `-${colorway}` : ""}${size ? `-${size}` : ""}`;
        const existing = cart.find((item) => item.id === cartItemId || (!colorway && !size && item.id === cap.id));
        const limit = maxStock !== undefined ? maxStock : (cap.stock ?? 99);

        if (limit <= 0) {
          // Out of stock; cannot add
          return;
        }

        const displayName = colorwayName
          ? `${cap.nameEn} (${colorwayName})`
          : cap.nameEn;

        if (existing) {
          const targetQty = existing.quantity + quantity;
          const newQty = Math.min(limit, targetQty);

          set({
            cart: cart.map((item) =>
              item.id === existing.id
                ? {
                    ...item,
                    quantity: newQty,
                    maxStock: limit,
                    ...(size ? { size } : {}),
                    ...(colorway ? { colorway } : {}),
                    ...(colorwayName ? { colorwayName } : {}),
                    ...(customImage ? { image: customImage } : {}),
                  }
                : item
            ),
            isCartOpen: true,
          });
        } else {
          const initialQty = Math.min(limit, Math.max(1, quantity));
          set({
            cart: [
              ...cart,
              {
                id: cartItemId,
                variantId: cap.id,
                name: displayName,
                priceUsd: cap.priceUsd,
                image: customImage || cap.image,
                silhouette: cap.silhouette,
                quantity: initialQty,
                maxStock: limit,
                ...(size ? { size } : {}),
                ...(colorway ? { colorway } : {}),
                ...(colorwayName ? { colorwayName } : {}),
              },
            ],
            isCartOpen: true,
          });
        }
      },

      removeFromCart: (id) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== id),
        })),

      updateQuantity: (id, delta, maxStock?: number) =>
        set((state) => ({
          cart: state.cart
            .map((item) => {
              if (item.id === id) {
                const limit = maxStock !== undefined ? maxStock : (item.maxStock ?? 99);
                const targetQty = item.quantity + delta;
                const newQty = Math.min(limit, targetQty);
                return newQty > 0 ? { ...item, quantity: newQty, maxStock: limit } : null;
              }
              return item;
            })
            .filter(Boolean) as CartItem[],
        })),

      clampCartToStock: (variants) => {
        const { cart } = get();
        if (!variants || variants.length === 0 || cart.length === 0) {
          return { adjusted: false, adjustedNames: [] };
        }

        let adjusted = false;
        const adjustedNames: string[] = [];

        const updatedCart = cart
          .map((item) => {
            const variant = variants.find((v) => v.variantId === (item.variantId || item.id));
            if (!variant) return item;

            const isAvailable = variant.isAvailable !== false;
            const stock = typeof variant.stock === "number" ? variant.stock : 0;
            const isUpcomingDrop = Boolean(
              variant.isDrop &&
              variant.dropStatus !== "live" &&
              ((typeof variant.dropDate === "number" && Date.now() < variant.dropDate) || variant.dropStatus === "scheduled")
            );

            if (!isAvailable || stock <= 0 || isUpcomingDrop) {
              adjusted = true;
              adjustedNames.push(item.name);
              return null; // Remove depleted, unavailable, or unreleased drop items
            }

            if (item.quantity > stock) {
              adjusted = true;
              adjustedNames.push(item.name);
              return { ...item, quantity: stock, maxStock: stock };
            }

            return { ...item, maxStock: stock };
          })
          .filter(Boolean) as CartItem[];

        if (adjusted) {
          set({ cart: updatedCart });
        }

        return { adjusted, adjustedNames };
      },

      clearCart: () => set({ cart: [] }),

      currency: "USD",
      setCurrency: (currency) => set({ currency }),

      theme: "light",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
          } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
          }
        }
      },
      toggleTheme: () => {
        const nextTheme = get().theme === "dark" ? "light" : "dark";
        get().setTheme(nextTheme);
      },

      quickViewCap: null,
      openQuickView: (cap) => set({ quickViewCap: cap }),
      closeQuickView: () => set({ quickViewCap: null }),

      dropAlertCap: null,
      openDropAlert: (cap) => set({ dropAlertCap: cap }),
      closeDropAlert: () => set({ dropAlertCap: null }),

      soundEnabled: true,
      toggleSound: () => {
        const next = !get().soundEnabled;
        set({ soundEnabled: next });
      },
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),


      // Virtual Try-On
      isTryOnOpen: false,
      tryOnTargetCap: null,
      tryOnImage: null,
      tryOnSettings: { offsetX: 0, offsetY: 0, scale: 1, tilt: 0, tiltX: 0 },
      openTryOn: (cap = null) =>
        set({ isTryOnOpen: true, tryOnTargetCap: cap }),
      closeTryOn: () =>
        set({ isTryOnOpen: false, tryOnTargetCap: null }),
      setTryOnImage: (img) => set({ tryOnImage: img }),
      setTryOnSettings: (settings) => set({ tryOnSettings: settings }),

      shareToast: null,
      showShareToast: (data) =>
        set({
          shareToast: {
            isOpen: true,
            ...data,
          },
        }),
      hideShareToast: () => set({ shareToast: null }),
    }),
    {
      name: "moyacaps-storage",
      // v1: tee lines need a colorway for per-SKU checkout (ADR 0015)
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedState;
        if (version < 1 && Array.isArray(state.cart)) {
          return { ...state, cart: backfillTeeColorways(state.cart) };
        }
        return state;
      },
      partialize: (state) => ({
        cart: state.cart,
        currency: state.currency,
        theme: state.theme,
        soundEnabled: state.soundEnabled,
        tryOnImage: state.tryOnImage,
        tryOnSettings: state.tryOnSettings,
      }),
    }
  )
);
