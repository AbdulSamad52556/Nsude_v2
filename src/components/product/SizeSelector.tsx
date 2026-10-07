"use client";

import { useId, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Size } from "@/lib/types";
import { cx } from "@/lib/utils";

interface SizeSelectorProps {
  sizes: Size[];
  unavailableSizes?: Size[];
  /** Formatted price per size, shown under each size when prices differ. */
  prices?: Partial<Record<Size, string>>;
  selected: Size | null;
  onChange: (size: Size) => void;
  /** Heading above the sizes. */
  label?: string;
}

export function SizeSelector({
  sizes,
  unavailableSizes = [],
  prices,
  selected,
  onChange,
  label = "Size",
}: SizeSelectorProps) {
  const [showGuide, setShowGuide] = useState(false);
  // The page and the phone size sheet each have a selector: separate groups
  // so the sliding fill never jumps between them.
  const groupId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-center justify-between text-xs uppercase tracking-widest2 text-ash">
        {label}
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="underline decoration-graphite/40 underline-offset-4 hover:text-ink"
          aria-expanded={showGuide}
        >
          Size guide
        </button>
      </legend>

      {/* Phones: five equal boxes across; large screens: fixed-size boxes. */}
      <LayoutGroup id={groupId}>
        <div className="grid grid-cols-5 gap-2 md:flex md:flex-wrap">
          {sizes.map((size) => {
            const isUnavailable = unavailableSizes.includes(size);
            const isSelected = selected === size;
            return (
              <motion.button
                key={size}
                type="button"
                disabled={isUnavailable}
                onClick={() => onChange(size)}
                aria-pressed={isSelected}
                whileTap={isUnavailable || reduceMotion ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={cx(
                  "relative flex flex-col items-center justify-center rounded-md border text-sm uppercase tracking-wide transition-[color,border-color] duration-300 ease-editorial",
                  prices ? "h-12 gap-0.5 md:w-20" : "h-10 md:w-16 md:text-[13px]",
                  isUnavailable &&
                    "cursor-not-allowed border-graphite/10 text-mist line-through",
                  !isUnavailable &&
                    isSelected &&
                    "border-ink text-paper",
                  !isUnavailable &&
                    !isSelected &&
                    "border-graphite/20 text-ink hover:border-ink"
                )}
              >
                {/* The black fill slides from the old size to the new one. */}
                {isSelected && (
                  <motion.span
                    layoutId="size-fill"
                    aria-hidden
                    className="absolute inset-[-1px] rounded-md bg-ink"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative">{size}</span>
                {prices?.[size] && (
                  <span className="relative text-[10px] normal-case tracking-normal opacity-70">{prices[size]}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>

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
