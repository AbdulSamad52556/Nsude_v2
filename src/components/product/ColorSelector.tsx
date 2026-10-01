"use client";

import Image from "next/image";
import { ColorVariant } from "@/lib/types";
import { cx } from "@/lib/utils";

interface ColorSelectorProps {
  variants: ColorVariant[];
  /** Product code of the selected colorway. */
  selected: string;
  onChange: (code: string) => void;
}

/** Each color is its own product, so it's shown as a photo of that colorway
    (falling back to its color if it has no photo yet). */
export function ColorSelector({ variants, selected, onChange }: ColorSelectorProps) {
  const current = variants.find((v) => v.code === selected);
  return (
    <fieldset>
      <legend className="mb-3 flex items-baseline gap-2 text-xs uppercase tracking-widest2 text-ash">
        Color <span className="text-ink">{current?.name}</span>
        {current?.stock === 0 && <span className="text-rust">· Sold out</span>}
      </legend>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {variants.map((variant) => {
          const isSelected = variant.code === selected;
          const soldOut = variant.stock === 0;
          const photo = variant.images[0];
          return (
            <button
              key={variant.code}
              type="button"
              onClick={() => onChange(variant.code)}
              aria-pressed={isSelected}
              aria-label={soldOut ? `${variant.name} (sold out)` : variant.name}
              title={soldOut ? `${variant.name} — sold out` : variant.name}
              className={cx(
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-md border-2 bg-bone transition-colors duration-300 md:w-[72px]",
                isSelected ? "border-moss" : "border-transparent hover:border-graphite/30"
              )}
            >
              {photo ? (
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes="72px"
                  className={cx("object-cover", soldOut && "opacity-40")}
                />
              ) : (
                <span
                  aria-hidden
                  className={cx("absolute inset-0", soldOut && "opacity-40")}
                  style={{ backgroundColor: variant.hex }}
                />
              )}
              {/* Diagonal strike for sold-out colors (still selectable to view). */}
              {soldOut && (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-[52deg] bg-graphite/60"
                />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
