"use client";

import { ColorVariant } from "@/lib/types";
import { cx } from "@/lib/utils";

interface ColorSelectorProps {
  variants: ColorVariant[];
  /** Product code of the selected colorway. */
  selected: string;
  onChange: (code: string) => void;
}

export function ColorSelector({ variants, selected, onChange }: ColorSelectorProps) {
  const current = variants.find((v) => v.code === selected);
  return (
    <fieldset>
      <legend className="mb-3 flex items-baseline gap-2 text-xs uppercase tracking-widest2 text-ash">
        Color <span className="text-ink">{current?.name}</span>
        {current?.stock === 0 && <span className="text-rust">· Sold out</span>}
      </legend>
      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => {
          const isSelected = variant.code === selected;
          const soldOut = variant.stock === 0;
          return (
            <button
              key={variant.code}
              type="button"
              onClick={() => onChange(variant.code)}
              aria-pressed={isSelected}
              aria-label={soldOut ? `${variant.name} (sold out)` : variant.name}
              title={soldOut ? `${variant.name} — sold out` : variant.name}
              className={cx(
                "relative flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ease-editorial",
                isSelected
                  ? "border-ink ring-1 ring-ink ring-offset-2 ring-offset-paper"
                  : "border-graphite/20 hover:border-graphite/50"
              )}
            >
              <span
                className={cx("h-6 w-6 rounded-full border border-black/10", soldOut && "opacity-40")}
                style={{ backgroundColor: variant.hex }}
              />
              {/* Diagonal strike for sold-out colors (still selectable to view). */}
              {soldOut && (
                <span aria-hidden className="absolute h-px w-7 -rotate-45 bg-graphite/70" />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
