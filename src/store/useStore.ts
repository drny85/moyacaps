import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CapVariant } from "@/data/caps";
import { migratePersisted } from "@/lib/cartMigration";
import { clampCart, type CartStockVariant } from "@/lib/cartStock";
import type { OpenCheckout } from "@/lib/openCheckout";

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
type PersistedState = Pick<StoreState, "cart" | "openCheckout" | "currency" | "theme" | "soundEnabled">;

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
  /** Fit each line to live stock: tees to their SKU, caps to the variant (see `clampCart`). */
  clampCartToStock: (variants: CartStockVariant[]) => {
    adjusted: boolean;
    adjustedNames: string[];
  };
  clearCart: () => void;

  // The Order and Checkout Session from the last Pay click (ADR 0024)
  openCheckout: OpenCheckout | null;
  setOpenCheckout: (openCheckout: OpenCheckout | null) => void;

  // Currency (USD only)
  currency: "USD";
  setCurrency: (currency: "USD") => void;

  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;

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
  openTryOn: (cap?: CapVariant | null) => void;
  closeTryOn: () => void;

  // Product search (plan 0006)
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;

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
        const { cart: updatedCart, adjusted, adjustedNames } = clampCart(get().cart, variants, Date.now());
        if (adjusted) set({ cart: updatedCart });
        return { adjusted, adjustedNames };
      },

      // A cleared cart (after payment) has no open checkout left to expire.
      clearCart: () => set({ cart: [], openCheckout: null }),

      openCheckout: null,
      setOpenCheckout: (openCheckout) => set({ openCheckout }),

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
      openTryOn: (cap = null) =>
        set({ isTryOnOpen: true, tryOnTargetCap: cap }),
      closeTryOn: () =>
        set({ isTryOnOpen: false, tryOnTargetCap: null }),

      isSearchOpen: false,
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),

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
      // v2: the Try-On Photo is never stored (ADR 0019); drop any saved copy
      version: 2,
      migrate: (persisted, version) => migratePersisted(persisted, version) as PersistedState,
      partialize: (state) => ({
        cart: state.cart,
        openCheckout: state.openCheckout,
        currency: state.currency,
        theme: state.theme,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
