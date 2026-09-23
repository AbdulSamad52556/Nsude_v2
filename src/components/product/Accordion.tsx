"use client";

import { Plus, Minus } from "lucide-react";
import { useState, ReactNode } from "react";

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-graphite/15 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-xs uppercase tracking-widest2 text-ink"
      >
        {title}
        {open ? <Minus size={15} strokeWidth={1.5} /> : <Plus size={15} strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="mt-3 text-sm leading-relaxed text-graphite">{children}</div>
      )}
    </div>
  );
}
