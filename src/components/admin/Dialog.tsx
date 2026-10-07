"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Centered panel over a dimmed page; Escape or the backdrop closes it. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Roomier panel (e.g. the banner cropper). */
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden />
      <div className={`relative max-h-[92svh] w-full overflow-y-auto rounded-t-xl bg-paper p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:rounded-xl sm:p-6 ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium uppercase tracking-widest2">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ash hover:text-ink">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Label + control + hint / error, for dialog forms. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-ash">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rust">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-ash">{hint}</span>
      )}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-taupe/50 bg-transparent px-3 text-sm focus:border-ink focus:outline-none";
export const primaryButton =
  "flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-60";
