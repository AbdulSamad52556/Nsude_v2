"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Product, Size } from "@/lib/types";
import { formatPrice, cx } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { ColorSelector } from "./ColorSelector";
import { SizeSelector } from "./SizeSelector";
import { QuantitySelector } from "./QuantitySelector";
import { AccordionItem } from "./Accordion";

export function ProductInfo({ product }: { product: Product }) {
  const [color, setColor] = useState(product.colors[0].name);
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  function validateSize() {
    if (!size) {
      setError(true);
      return false;
    }
    return true;
  }

  function handleAddToBag() {
    if (!validateSize() || !size) return;
    addItem(product, size, color, quantity);
  }

  function handleBuyNow() {
    if (!validateSize() || !size) return;
    addItem(product, size, color, quantity);
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
        <p className="mt-2 text-lg text-ink">{formatPrice(product.price)}</p>
      </div>

      <p className="max-w-md text-sm leading-relaxed text-graphite">
        {product.description}
      </p>

      <ColorSelector colors={product.colors} selected={color} onChange={setColor} />

      <div>
        <SizeSelector
          sizes={product.sizes}
          unavailableSizes={product.unavailableSizes}
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
          className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors duration-300 hover:bg-graphite"
        >
          Add to Bag
          <ArrowRight
            size={16}
            strokeWidth={1.5}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          className="flex h-14 w-full items-center justify-center border border-ink text-sm uppercase tracking-widest2 text-ink transition-colors duration-300 hover:bg-ink hover:text-bone"
        >
          Buy Now
        </button>
      </div>

      <div className={cx(product.stock < 15 && "text-rust", "text-xs uppercase tracking-widest2 text-ash")}>
        {product.stock < 15 ? `Only ${product.stock} left in stock` : "In stock, ready to ship"}
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
