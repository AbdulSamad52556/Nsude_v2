"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ColorVariant, Product, Size, priceFor } from "@/lib/types";
import { MAX_LINE_QUANTITY } from "@/lib/checkout";
import { track } from "@/lib/track";

const clampQuantity = (q: number) => Math.min(MAX_LINE_QUANTITY, Math.max(1, q));

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  size: Size;
  /** Color name, for display. */
  color: string;
  /** Product code of this colorway (links to /product/<code>). Absent on
      lines saved in the bag before product codes existed. */
  code?: string;
  quantity: number;
}

/** Where a bag line links: its colorway's page, or the shop for old lines. */
export function cartLineHref(line: CartLine) {
  return line.code ? `/product/${line.code}` : "/shop";
}

interface CartContextValue {
  lines: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Adds a line and opens the bag drawer, unless `openDrawer` is false
      (e.g. Buy Now, which goes straight to checkout). */
  addItem: (
    product: Product,
    variant: ColorVariant,
    size: Size,
    quantity?: number,
    options?: { openDrawer?: boolean }
  ) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "nsude-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Latest lines, so remove / quantity events can say which item it was.
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const addItem = useCallback(
    (product: Product, variant: ColorVariant, size: Size, quantity = 1, { openDrawer = true } = {}) => {
      const key = `${variant.code}-${size}`;
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) =>
            l.key === key ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l
          );
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            name: product.name,
            image: variant.images[0]?.src ?? "",
            // The price of this exact color + size.
            price: priceFor(product, variant, size),
            size,
            color: variant.name,
            code: variant.code,
            quantity: clampQuantity(quantity),
          },
        ];
      });
      if (openDrawer) setIsOpen(true);
      track(openDrawer ? "add_to_bag" : "buy_now", {
        product: product.name,
        code: variant.code,
        color: variant.name,
        size,
        quantity,
        price: priceFor(product, variant, size),
      });
    },
    []
  );

  const removeItem = useCallback((key: string) => {
    const line = linesRef.current.find((l) => l.key === key);
    if (line) track("remove_from_bag", { product: line.name, code: line.code, size: line.size, quantity: line.quantity });
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    const line = linesRef.current.find((l) => l.key === key);
    if (line && line.quantity !== clampQuantity(quantity)) {
      track("bag_quantity", { product: line.name, code: line.code, size: line.size, from: line.quantity, to: clampQuantity(quantity) });
    }
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: clampQuantity(quantity) } : l))
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const openCart = useCallback(() => {
    setIsOpen(true);
    track("bag_open", { items: linesRef.current.reduce((n, l) => n + l.quantity, 0) });
  }, []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines]
  );
  const count = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const value: CartContextValue = {
    lines,
    isOpen,
    openCart,
    closeCart,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    subtotal,
    count,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
