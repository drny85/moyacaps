import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CapVariant } from "@/data/caps";

export interface CartItem {
  id: string;
  name: string;
  priceUsd: number;
  image: string;
  silhouette: string;
  quantity: number;
  maxStock?: number;
}

interface StoreState {
  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (cap: CapVariant, quantity?: number, maxStock?: number) => void;
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

      addToCart: (cap, quantity = 1, maxStock?: number) => {
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
        const existing = cart.find((item) => item.id === cap.id);
        const limit = maxStock !== undefined ? maxStock : (cap.stock ?? 99);

        if (limit <= 0) {
          // Out of stock; cannot add
          return;
        }

        if (existing) {
          const targetQty = existing.quantity + quantity;
          const newQty = Math.min(limit, targetQty);

          set({
            cart: cart.map((item) =>
              item.id === cap.id
                ? { ...item, quantity: newQty, maxStock: limit }
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
                id: cap.id,
                name: cap.nameEn,
                priceUsd: cap.priceUsd,
                image: cap.image,
                silhouette: cap.silhouette,
                quantity: initialQty,
                maxStock: limit,
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
            const variant = variants.find((v) => v.variantId === item.id);
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
      partialize: (state) => ({
        cart: state.cart,
        currency: state.currency,
        theme: state.theme,
      }),
    }
  )
);
