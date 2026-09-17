import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CapVariant } from "@/data/caps";

export interface CartItem {
  id: string;
  name: string;
  priceUsd: number;
  priceMxn: number;
  image: string;
  silhouette: string;
  quantity: number;
}

interface StoreState {
  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (cap: CapVariant, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;

  // Currency
  currency: "USD" | "MXN";
  setCurrency: (currency: "USD" | "MXN") => void;

  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;

  // Quick View Modal
  quickViewCap: CapVariant | null;
  openQuickView: (cap: CapVariant) => void;
  closeQuickView: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      isCartOpen: false,
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
      toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),

      addToCart: (cap, quantity = 1) => {
        const { cart } = get();
        const existing = cart.find((item) => item.id === cap.id);

        if (existing) {
          set({
            cart: cart.map((item) =>
              item.id === cap.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
            isCartOpen: true,
          });
        } else {
          set({
            cart: [
              ...cart,
              {
                id: cap.id,
                name: cap.nameEn,
                priceUsd: cap.priceUsd,
                priceMxn: cap.priceMxn,
                image: cap.image,
                silhouette: cap.silhouette,
                quantity,
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

      updateQuantity: (id, delta) =>
        set((state) => ({
          cart: state.cart
            .map((item) => {
              if (item.id === id) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
              }
              return item;
            })
            .filter(Boolean) as CartItem[],
        })),

      clearCart: () => set({ cart: [] }),

      currency: "USD",
      setCurrency: (currency) => set({ currency }),

      theme: "dark",
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
