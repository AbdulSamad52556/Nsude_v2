"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShoppingBag, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";
import { CartItem } from "./CartItem";

export function CartDrawer() {
  const { lines, isOpen, closeCart, subtotal, count } = useCart();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[97] bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={closeCart}
            aria-hidden
          />
          {/* Boxed reference frame: keeps the sliding panel aligned to the
              1440px column's right edge instead of the true viewport edge. */}
          <div className="pointer-events-none fixed inset-0 z-[98] mx-auto max-w-[1440px]">
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-graphite/10 px-6 py-5">
              <h2 className="text-sm uppercase tracking-widest2 text-ink">
                Your Bag ({count})
              </h2>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close bag"
                className="text-ink transition-opacity hover:opacity-60"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <ShoppingBag size={32} strokeWidth={1} className="text-ash" />
                <p className="text-sm text-graphite">Your bag is empty.</p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="text-xs uppercase tracking-widest2 text-ink underline underline-offset-4"
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <>
                <ul className="flex-1 overflow-y-auto px-6">
                  {lines.map((line) => (
                    <CartItem key={line.key} line={line} />
                  ))}
                </ul>

                <div className="border-t border-graphite/10 px-6 py-6">
                  <div className="mb-5 flex items-center justify-between text-sm text-ink">
                    <span className="uppercase tracking-widest2 text-ash">
                      Subtotal
                    </span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={closeCart}
                    className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite"
                  >
                    Checkout
                    <ArrowRight
                      size={16}
                      strokeWidth={1.5}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-3 flex h-12 w-full items-center justify-center text-xs uppercase tracking-widest2 text-graphite hover:text-ink"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </motion.aside>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
