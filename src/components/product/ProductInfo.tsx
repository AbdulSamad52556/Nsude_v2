"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ColorVariant, Product, Size, priceFor, priceRange } from "@/lib/types";
import { formatPrice, formatPriceRange, cx } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { ColorSelector } from "./ColorSelector";
import { SizeSelector } from "./SizeSelector";
import { QuantitySelector } from "./QuantitySelector";
import { AccordionItem } from "./Accordion";

interface ProductInfoProps {
  product: Product;
  /** The selected colorway; stock and sold-out sizes come from it. */
  variant: ColorVariant;
  onColorChange: (code: string) => void;
}

export function ProductInfo({ product, variant, onColorChange }: ProductInfoProps) {
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  const soldOut = variant.stock === 0;
  // Price depends on color and size: exact once a size is picked, else the
  // color's range ("From ₹…") if its sizes are priced differently.
  const range = priceRange(product, [variant]);
  const priceText = size ? formatPrice(priceFor(product, variant, size)) : formatPriceRange(range);
  const sizesVaryInPrice = range.min !== range.max;
  // A sold-out color has no sizes to pick; otherwise use its own list.
  const unavailableSizes = soldOut ? product.sizes : variant.unavailableSizes;

  // Switching to a color where the chosen size is sold out clears the pick.
  useEffect(() => {
    setSize((current) => (current && unavailableSizes.includes(current) ? null : current));
  }, [unavailableSizes]);

  function validateSize() {
    if (!size) {
      setError(true);
      return false;
    }
    return true;
  }

  function handleAddToBag() {
    if (soldOut || !validateSize() || !size) return;
    addItem(product, variant, size, quantity);
  }

  function handleBuyNow() {
    if (soldOut || !validateSize() || !size) return;
    addItem(product, variant, size, quantity);
    router.push("/checkout");
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        {product.newArrival && (
          <span className="mb-3 inline-block text-xs uppercase tracking-widest2 text-rust">
            New Arrival
          </span>
        )}
        <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">
          {product.name}
        </h1>
        <p className="mt-2 text-lg text-ink" aria-live="polite">{priceText}</p>
      </div>

      <p className="max-w-md text-sm leading-relaxed text-graphite">
        {product.description}
      </p>

      <ColorSelector variants={product.variants} selected={variant.code} onChange={onColorChange} />

      <div>
        <SizeSelector
          sizes={product.sizes}
          unavailableSizes={unavailableSizes}
          // Show each size's price only when this color's sizes differ.
          prices={
            sizesVaryInPrice
              ? Object.fromEntries(product.sizes.map((s) => [s, formatPrice(priceFor(product, variant, s))]))
              : undefined
          }
          selected={size}
          onChange={(s) => {
            setSize(s);
            setError(false);
          }}
        />
        {error && (
          <p className="mt-2 text-xs text-rust" role="alert">
            Please select a size to continue.
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs uppercase tracking-widest2 text-ash">Qty</span>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAddToBag}
          disabled={soldOut}
          className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors duration-300 hover:bg-graphite disabled:cursor-not-allowed disabled:bg-graphite/40"
        >
          {soldOut ? `${variant.name} — Sold Out` : "Add to Bag"}
          {!soldOut && (
            <ArrowRight
              size={16}
              strokeWidth={1.5}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          )}
        </button>
        {!soldOut && (
          <button
            type="button"
            onClick={handleBuyNow}
            className="flex h-14 w-full items-center justify-center border border-ink text-sm uppercase tracking-widest2 text-ink transition-colors duration-300 hover:bg-ink hover:text-bone"
          >
            Buy Now
          </button>
        )}
      </div>

      <div className={cx("text-xs uppercase tracking-widest2", variant.stock < 15 ? "text-rust" : "text-ash")}>
        {soldOut
          ? "Sold out in this color — try another"
          : variant.stock < 15
            ? `Only ${variant.stock} left in ${variant.name}`
            : "In stock, ready to ship"}
      </div>

      <div>
        <AccordionItem title="Shipping & Returns" defaultOpen>
          <p>
            Free standard shipping on orders over ₹2,999. Delivered within
            3–6 business days across India. Easy 14-day returns on unworn
            items with tags attached.
          </p>
        </AccordionItem>
        <AccordionItem title="Fabric & Fit">
          <p>
            {product.material} · {product.weight} · {product.fit} fit.{" "}
            {product.story}
          </p>
        </AccordionItem>
        <AccordionItem title="Measurements">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-graphite/15 text-ash">
                  <th className="py-2 pr-4 font-normal uppercase tracking-wide">
                    Size
                  </th>
                  {product.sizes.map((s) => (
                    <th
                      key={s}
                      className={cx(
                        "py-2 pr-4 font-normal",
                        size === s && "text-ink"
                      )}
                    >
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.measurements.map((row) => (
                  <tr key={row.label} className="border-b border-graphite/10">
                    <td className="py-2 pr-4 uppercase tracking-wide text-ash">
                      {row.label}
                    </td>
                    {product.sizes.map((s) => (
                      <td
                        key={s}
                        className={cx("py-2 pr-4", size === s && "font-medium text-ink")}
                      >
                        {row.values[s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionItem>
        <AccordionItem title="Care Instructions">
          <p>
            Machine wash cold with like colors. Do not bleach. Tumble dry
            low. Warm iron if needed. Avoid direct heat on any printed or
            embroidered detail.
          </p>
        </AccordionItem>
        <AccordionItem title="Model Information">
          <p>Model is 6&apos;1&quot; (185cm), 78kg, wearing a size M.</p>
        </AccordionItem>
      </div>
    </div>
  );
}
