"use client";

import { useState } from "react";
import { Size } from "@/lib/types";
import { cx } from "@/lib/utils";

interface SizeSelectorProps {
  sizes: Size[];
  unavailableSizes?: Size[];
  selected: Size | null;
  onChange: (size: Size) => void;
}

export function SizeSelector({
  sizes,
  unavailableSizes = [],
  selected,
  onChange,
}: SizeSelectorProps) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-center justify-between text-xs uppercase tracking-widest2 text-ash">
        Size
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="underline decoration-graphite/40 underline-offset-4 hover:text-ink"
          aria-expanded={showGuide}
        >
          Size guide
        </button>
      </legend>

      <div className="grid grid-cols-5 gap-2">
        {sizes.map((size) => {
          const isUnavailable = unavailableSizes.includes(size);
          const isSelected = selected === size;
          return (
            <button
              key={size}
              type="button"
              disabled={isUnavailable}
              onClick={() => onChange(size)}
              aria-pressed={isSelected}
              className={cx(
                "relative flex h-12 items-center justify-center border text-sm uppercase tracking-wide transition-all duration-200 ease-editorial",
                isUnavailable &&
                  "cursor-not-allowed border-graphite/10 text-mist line-through",
                !isUnavailable &&
                  isSelected &&
                  "border-ink bg-ink text-bone",
                !isUnavailable &&
                  !isSelected &&
                  "border-graphite/20 text-ink hover:border-ink"
              )}
            >
              {size}
            </button>
          );
        })}
      </div>

      {showGuide && (
        <div className="mt-4 border border-graphite/15 p-4 text-xs leading-relaxed text-graphite">
          <p className="mb-2 uppercase tracking-widest2 text-ash">
            How to measure
          </p>
          <p>
            Chest: measure across the fullest part of your chest, underarm to
            underarm. Shoulder: measure from one shoulder seam to the other
            across the back. If between sizes, size up for a relaxed fit or
            down for a closer fit.
          </p>
        </div>
      )}
    </fieldset>
  );
}
