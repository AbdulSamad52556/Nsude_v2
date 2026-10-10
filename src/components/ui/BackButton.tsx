"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cx } from "@/lib/utils";

/** Back arrow: returns to the previous page, or to `fallbackHref` when the
    visitor landed here directly (no history to go back to). */
export function BackButton({
  fallbackHref = "/shop",
  className,
  label,
}: {
  fallbackHref?: string;
  className?: string;
  /** Shown beside the arrow (otherwise it's an icon-only button). */
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      aria-label={label ? undefined : "Go back"}
      className={cx(
        label
          ? "group flex items-center gap-1 text-xs uppercase tracking-widest2 text-graphite transition-colors hover:text-ink"
          : "flex h-10 w-10 items-center justify-center text-ink",
        className
      )}
    >
      <ChevronLeft
        size={label ? 16 : 22}
        strokeWidth={1.5}
        className={label ? "transition-transform duration-300 group-hover:-translate-x-0.5" : undefined}
      />
      {label}
    </button>
  );
}
