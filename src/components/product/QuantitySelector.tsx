"use client";

import { Minus, Plus } from "lucide-react";

export function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center border border-graphite/20">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
        className="flex h-12 w-11 items-center justify-center text-ink transition-opacity hover:opacity-60 disabled:opacity-30"
        disabled={value <= 1}
      >
        <Minus size={14} strokeWidth={1.5} />
      </button>
      <span className="flex h-12 w-10 items-center justify-center text-sm" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(9, value + 1))}
        aria-label="Increase quantity"
        className="flex h-12 w-11 items-center justify-center text-ink transition-opacity hover:opacity-60 disabled:opacity-30"
        disabled={value >= 9}
      >
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
