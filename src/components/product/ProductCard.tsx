"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ColorVariant, Product, priceRange, productHref } from "@/lib/types";
import { formatPriceRange, cx } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  /** The colorway this card shows; defaults to the product's first color. */
  variant?: ColorVariant;
  priority?: boolean;
  className?: string;
  imageAspect?: string;
}

export function ProductCard({
  product,
  variant = product.variants[0],
  priority,
  className,
  imageAspect = "aspect-[4/5]",
}: ProductCardProps) {
  const [primary, secondary] = variant?.images ?? [];
  const soldOut = variant ? variant.stock === 0 : false;

  return (
    <Link
      href={productHref(variant)}
      className={cx("group block", className)}
      data-cursor="View"
    >
      <div className={cx("relative w-full overflow-hidden bg-bone", imageAspect)}>
        {primary && (
          <Image
            src={primary.src}
            alt={primary.alt || `${product.name} in ${variant.name}`}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-all duration-700 ease-editorial group-hover:scale-[1.03] group-hover:opacity-0"
          />
        )}
        {secondary && (
          <Image
            src={secondary.src}
            alt={secondary.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="scale-105 object-cover opacity-0 transition-all duration-700 ease-editorial group-hover:scale-100 group-hover:opacity-100"
          />
        )}

        {soldOut ? (
          <span className="absolute left-4 top-4 bg-paper px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-ink">
            Sold Out
          </span>
        ) : (
          product.newArrival && (
            <span className="absolute left-4 top-4 bg-ink px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-bone">
              New
            </span>
          )
        )}

        <span className="absolute bottom-4 left-4 flex translate-y-2 items-center gap-1.5 text-[11px] uppercase tracking-widest2 text-ink opacity-0 transition-all duration-500 ease-editorial group-hover:translate-y-0 group-hover:opacity-100">
          View product <ArrowUpRight size={13} strokeWidth={1.5} />
        </span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="transition-transform duration-500 ease-editorial group-hover:translate-x-1">
          <h3 className="text-sm uppercase tracking-wide text-ink">{product.name}</h3>
          <p className="mt-1 text-xs text-ash">
            {variant?.name} · {product.fit} fit
          </p>
        </div>
        <p className="shrink-0 text-sm text-ink">{formatPriceRange(priceRange(product, [variant]))}</p>
      </div>

      {/* Other colorways; the one this card shows is ringed. */}
      {product.variants.length > 1 && (
        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          {product.variants.map((v) => (
            <span
              key={v.code}
              className={cx(
                "h-3 w-3 rounded-full border border-graphite/15",
                v.code === variant?.code && "ring-1 ring-ink ring-offset-2 ring-offset-paper"
              )}
              style={{ backgroundColor: v.hex }}
            />
          ))}
        </div>
      )}
    </Link>
  );
}
