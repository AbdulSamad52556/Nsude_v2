"use client";

import { ColorOption } from "@/lib/types";
import { cx } from "@/lib/utils";

interface ColorSelectorProps {
  colors: ColorOption[];
  selected: string;
  onChange: (name: string) => void;
}

export function ColorSelector({ colors, selected, onChange }: ColorSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-3 flex items-baseline gap-2 text-xs uppercase tracking-widest2 text-ash">
        Color <span className="text-ink">{selected}</span>
      </legend>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isSelected = color.name === selected;
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onChange(color.name)}
              aria-pressed={isSelected}
              aria-label={color.name}
              title={color.name}
              className={cx(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ease-editorial",
                isSelected
                  ? "border-ink ring-1 ring-ink ring-offset-2 ring-offset-paper"
                  : "border-graphite/20 hover:border-graphite/50"
              )}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10"
                style={{ backgroundColor: color.hex }}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
