"use client";

import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { CartLine, useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

export function CartItem({ line }: { line: CartLine }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <li className="flex gap-4 border-b border-graphite/10 py-6">
      <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-bone">
        {line.image && <Image src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm uppercase tracking-wide text-ink">{line.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-wide text-ash">
              {line.color} · {line.size}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(line.key)}
            aria-label={`Remove ${line.name} from bag`}
            className="text-ash transition-colors hover:text-ink"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center border border-graphite/20">
            <button
              type="button"
              onClick={() => updateQuantity(line.key, line.quantity - 1)}
              aria-label="Decrease quantity"
              disabled={line.quantity <= 1}
              className="flex h-8 w-8 items-center justify-center disabled:opacity-30"
            >
              <Minus size={12} strokeWidth={1.5} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center text-xs">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(line.key, line.quantity + 1)}
              aria-label="Increase quantity"
              className="flex h-8 w-8 items-center justify-center"
            >
              <Plus size={12} strokeWidth={1.5} />
            </button>
          </div>
          <p className="text-sm text-ink">{formatPrice(line.price * line.quantity)}</p>
        </div>
      </div>
    </li>
  );
}
