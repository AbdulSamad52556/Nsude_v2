"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Minus, Plus, X, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

const FREE_SHIPPING_THRESHOLD = 2999;
const SHIPPING_COST = 149;

export default function CartPage() {
  const { lines, updateQuantity, removeItem, subtotal } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  function applyPromo(e: React.FormEvent) {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setPromoMessage("Invalid or expired code.");
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-6 px-5 pb-24 pt-32 text-center md:pt-40">
        <ShoppingBag size={40} strokeWidth={1} className="text-ash" />
        <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">
          Your Bag
        </h1>
        <p className="max-w-sm text-sm text-graphite">
          Your bag is currently empty. Explore the collection to find your
          next essential.
        </p>
        <Link
          href="/shop"
          className="group mt-2 inline-flex items-center gap-2 border-b border-ink pb-1 text-sm uppercase tracking-widest2 text-ink"
        >
          Continue Shopping
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-5 pb-24 pt-32 md:px-10 md:pt-40">
      <h1 className="mb-14 text-display-lg font-medium uppercase tracking-tighter text-ink">
        Your Bag
      </h1>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-[1fr_380px]">
        <ul>
          {lines.map((line) => (
            <li
              key={line.key}
              className="flex gap-6 border-b border-graphite/10 py-8 first:pt-0"
            >
              <Link href={`/product/${line.slug}`} className="relative h-40 w-32 shrink-0 overflow-hidden bg-bone">
                <Image src={line.image} alt={line.name} fill sizes="128px" className="object-cover" />
              </Link>

              <div className="flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/product/${line.slug}`}
                      className="text-sm uppercase tracking-wide text-ink hover:opacity-70"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-1 text-xs uppercase tracking-wide text-ash">
                      {line.color} · Size {line.size}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.key)}
                    aria-label={`Remove ${line.name}`}
                    className="text-ash transition-colors hover:text-ink"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center border border-graphite/20">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.key, line.quantity - 1)}
                      aria-label="Decrease quantity"
                      disabled={line.quantity <= 1}
                      className="flex h-10 w-10 items-center justify-center disabled:opacity-30"
                    >
                      <Minus size={13} strokeWidth={1.5} />
                    </button>
                    <span className="flex h-10 w-10 items-center justify-center text-sm">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.key, line.quantity + 1)}
                      aria-label="Increase quantity"
                      className="flex h-10 w-10 items-center justify-center"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                  <p className="text-sm text-ink">{formatPrice(line.price * line.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex h-fit flex-col gap-6 border border-graphite/15 p-6 md:sticky md:top-28">
          <h2 className="text-xs uppercase tracking-widest2 text-ash">Order Summary</h2>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between text-graphite">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-graphite">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-ash">
                Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.
              </p>
            )}
          </div>

          <form onSubmit={applyPromo} className="flex flex-col gap-2 border-t border-graphite/10 pt-4">
            <label htmlFor="promo" className="text-xs uppercase tracking-widest2 text-ash">
              Discount Code
            </label>
            <div className="flex border-b border-graphite/20 pb-2">
              <input
                id="promo"
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoMessage(null);
                }}
                placeholder="Enter code"
                className="w-full bg-transparent text-sm uppercase tracking-wide text-ink placeholder:text-ash focus:outline-none"
              />
              <button type="submit" className="text-xs uppercase tracking-widest2 text-ink hover:opacity-60">
                Apply
              </button>
            </div>
            {promoMessage && <p className="text-xs text-rust">{promoMessage}</p>}
          </form>

          <div className="flex items-center justify-between border-t border-graphite/10 pt-4 text-sm text-ink">
            <span className="uppercase tracking-widest2 text-ash">Total</span>
            <span className="text-lg">{formatPrice(total)}</span>
          </div>

          <Link
            href="/checkout"
            className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite"
          >
            Checkout
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link
            href="/shop"
            className="text-center text-xs uppercase tracking-widest2 text-graphite hover:text-ink"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
