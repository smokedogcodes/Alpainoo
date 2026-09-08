"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  /** Unique line key: productId or productId:variantId */
  lineId: string;
  productId: string;
  variantId?: string;
  slug: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
};

type CartState = {
  items: CartItem[];
  addItem: (
    item: Omit<CartItem, "quantity" | "lineId"> & { lineId?: string },
    qty?: number
  ) => void;
  removeItem: (lineId: string) => void;
  updateQty: (lineId: string, quantity: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

function lineIdFor(productId: string, variantId?: string) {
  return variantId ? `${productId}:${variantId}` : productId;
}

function migrateItem(raw: Record<string, unknown>): CartItem | null {
  const productId = String(raw.productId || "");
  if (!productId) return null;
  const variantId = raw.variantId ? String(raw.variantId) : undefined;
  return {
    lineId: String(raw.lineId || lineIdFor(productId, variantId)),
    productId,
    variantId,
    slug: String(raw.slug || ""),
    title: String(raw.title || ""),
    price: Number(raw.price || 0),
    image: String(raw.image || ""),
    quantity: Number(raw.quantity || 1),
    stock: Number(raw.stock || 0),
  };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, qty = 1) => {
        const lineId = item.lineId || lineIdFor(item.productId, item.variantId);
        set((state) => {
          const existing = state.items.find((i) => i.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === lineId
                  ? { ...i, quantity: Math.min(i.stock, i.quantity + qty) }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                ...item,
                lineId,
                quantity: Math.min(item.stock, qty),
              },
            ],
          };
        });
      },
      removeItem: (lineId) =>
        set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),
      updateQty: (lineId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.lineId === lineId
                ? { ...i, quantity: Math.max(0, Math.min(i.stock, quantity)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      subtotal: () => get().items.reduce((n, i) => n + i.price * i.quantity, 0),
    }),
    {
      name: "alpainoo-cart",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: unknown[] } | null;
        if (!state?.items) return { items: [] };
        return {
          items: state.items
            .map((i) => migrateItem((i || {}) as Record<string, unknown>))
            .filter(Boolean) as CartItem[],
        };
      },
    }
  )
);
