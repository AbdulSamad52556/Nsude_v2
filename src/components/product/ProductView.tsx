"use client";

import { useCallback, useEffect, useState } from "react";
import { findVariant, priceRange, productHref, type Product } from "@/lib/types";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { track } from "@/lib/track";

/**
 * Gallery + details for one product, driven by the selected colorway.
 * Each color has its own URL (/product/<code>). Picking a color swaps the
 * photos, stock and sold-out sizes instantly and moves the address bar to
 * that color's code with replaceState — no page load, no extra history
 * entry — so the URL is always shareable and a reload keeps the color.
 */
export function ProductView({
  product,
  initialCode,
  breadcrumb,
}: {
  product: Product;
  initialCode: string;
  /** Shown above the photos on large screens, starting where they start. */
  breadcrumb?: React.ReactNode;
}) {
  const [code, setCode] = useState(initialCode);
  const variant = findVariant(product, code);

  // A real navigation to another color of this product (e.g. a search
  // result) re-renders with a new initialCode; follow it.
  useEffect(() => setCode(initialCode), [initialCode]);

  useEffect(() => {
    track("product_view", {
      product: product.name,
      code: variant.code,
      color: variant.name,
      price: priceRange(product, [variant]).min,
      inStock: variant.stock > 0,
    });
  }, [product, variant]);

  const changeColor = useCallback(
    (next: string) => {
      setCode(next);
      const target = product.variants.find((v) => v.code === next);
      if (target) window.history.replaceState(window.history.state, "", productHref(target));
    },
    [product]
  );

  return (
    <div className="mx-auto grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
      {/* Large screens: the photos are capped to the screen height and sit
          against the details; the breadcrumb lines up with them. */}
      <div className="md:ml-auto md:w-full md:max-w-[calc((100svh-14rem)*0.8+6rem)]">
        {breadcrumb && <div className="mb-8 hidden h-4 md:block">{breadcrumb}</div>}
        {/* Keyed by color so the gallery restarts on that color's first photo. */}
        <ProductGallery
          key={variant.code}
          images={variant.images}
          badge={variant.stock === 0 ? "sold-out" : product.newArrival ? "new" : null}
        />
      </div>
      {/* Pushed down by the breadcrumb's height so the name lines up with the
          photo, and as wide as the photo column at most — so the space left of
          the photos matches the space right of the details. */}
      <div className="md:sticky md:top-28 md:h-fit md:w-full md:max-w-[calc((100svh-14rem)*0.8+6rem)] md:pt-12">
        <ProductInfo product={product} variant={variant} onColorChange={changeColor} />
      </div>
    </div>
  );
}
