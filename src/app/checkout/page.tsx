"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

const SHIPPING_COST = 149;
const FREE_SHIPPING_THRESHOLD = 2999;

function Field({
  label,
  id,
  type = "text",
  required = true,
  autoComplete,
  span,
}: {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm text-ink focus:border-ink focus:outline-none"
      />
    </div>
  );
}

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);
  const [orderId] = useState(() => `NSUDE-${Math.floor(100000 + Math.random() * 900000)}`);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPlaced(true);
    clear();
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-6 px-5 pb-24 pt-32 text-center md:pt-40">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ink">
          <Check size={22} strokeWidth={1.5} />
        </span>
        <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">
          Order Confirmed
        </h1>
        <p className="max-w-sm text-sm text-graphite">
          Thank you. Your order{" "}
          <span className="text-ink">#{orderId}</span> has been placed. A
          confirmation has been sent to your email.
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

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-6 px-5 pb-24 pt-32 text-center md:pt-40">
        <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">
          Nothing to Checkout
        </h1>
        <p className="text-sm text-graphite">Your bag is empty.</p>
        <Link
          href="/shop"
          className="group mt-2 inline-flex items-center gap-2 border-b border-ink pb-1 text-sm uppercase tracking-widest2 text-ink"
        >
          Shop Now
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-5 pb-24 pt-32 md:px-10 md:pt-40">
      <h1 className="mb-14 text-display-lg font-medium uppercase tracking-tighter text-ink">
        Checkout
      </h1>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-[1fr_380px]">
        <form id="checkout-form" onSubmit={handleSubmit} className="flex flex-col gap-12">
          <section>
            <h2 className="mb-5 text-xs uppercase tracking-widest2 text-ink">
              01 — Contact
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Email Address" id="email" type="email" autoComplete="email" span />
              <Field label="Phone Number" id="phone" type="tel" autoComplete="tel" span />
            </div>
          </section>

          <section>
            <h2 className="mb-5 text-xs uppercase tracking-widest2 text-ink">
              02 — Shipping
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="First Name" id="firstName" autoComplete="given-name" />
              <Field label="Last Name" id="lastName" autoComplete="family-name" />
              <Field label="Address" id="address" autoComplete="street-address" span />
              <Field label="City" id="city" autoComplete="address-level2" />
              <Field label="State" id="state" autoComplete="address-level1" />
              <Field label="PIN Code" id="pincode" autoComplete="postal-code" />
              <Field label="Country" id="country" autoComplete="country-name" />
            </div>
          </section>

          <section>
            <h2 className="mb-5 flex items-center gap-2 text-xs uppercase tracking-widest2 text-ink">
              03 — Payment <Lock size={12} strokeWidth={1.5} className="text-ash" />
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Card Number" id="cardNumber" autoComplete="cc-number" span />
              <Field label="Expiry (MM/YY)" id="expiry" autoComplete="cc-exp" />
              <Field label="CVV" id="cvv" autoComplete="cc-csc" />
            </div>
          </section>

          <button
            type="submit"
            className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite md:hidden"
          >
            Place Order
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </form>

        <div className="flex h-fit flex-col gap-6 border border-graphite/15 p-6 md:sticky md:top-28">
          <h2 className="text-xs uppercase tracking-widest2 text-ash">Order Summary</h2>
          <ul className="flex flex-col gap-4">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-4">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-bone">
                  <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-bone">
                    {line.quantity}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink">{line.name}</p>
                    <p className="text-xs text-ash">
                      {line.color} · {line.size}
                    </p>
                  </div>
                  <span className="text-xs text-ink">{formatPrice(line.price * line.quantity)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-graphite/10 pt-4 text-sm">
            <div className="flex items-center justify-between text-graphite">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-graphite">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-graphite/10 pt-3 text-ink">
              <span className="uppercase tracking-widest2 text-ash">Total</span>
              <span className="text-lg">{formatPrice(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            form="checkout-form"
            className="group hidden h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite md:flex"
          >
            Place Order
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

