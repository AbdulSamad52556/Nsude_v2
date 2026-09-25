"use client";

import { useCallback, useEffect, useState } from "react";
import { findVariant, productHref, type Product } from "@/lib/types";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";

/**
 * Gallery + details for one product, driven by the selected colorway.
 * Each color has its own URL (/product/<code>). Picking a color swaps the
 * photos, stock and sold-out sizes instantly and moves the address bar to
 * that color's code with replaceState — no page load, no extra history
 * entry — so the URL is always shareable and a reload keeps the color.
 */
export function ProductView({ product, initialCode }: { product: Product; initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const variant = findVariant(product, code);

  // A real navigation to another color of this product (e.g. a search
  // result) re-renders with a new initialCode; follow it.
  useEffect(() => setCode(initialCode), [initialCode]);

  const changeColor = useCallback(
    (next: string) => {
      setCode(next);
      const target = product.variants.find((v) => v.code === next);
      if (target) window.history.replaceState(window.history.state, "", productHref(target));
    },
    [product]
  );

  return (
    <div className="mx-auto grid max-w-content grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
      {/* Keyed by color so the gallery restarts on that color's first photo. */}
      <ProductGallery key={variant.code} images={variant.images} />
      <div className="md:sticky md:top-28 md:h-fit">
        <ProductInfo product={product} variant={variant} onColorChange={changeColor} />
      </div>
    </div>
  );
}
