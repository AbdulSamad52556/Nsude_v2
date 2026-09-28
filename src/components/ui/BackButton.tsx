"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cx } from "@/lib/utils";

/** Back arrow: returns to the previous page, or to `fallbackHref` when the
    visitor landed here directly (no history to go back to). */
export function BackButton({ fallbackHref = "/shop", className }: { fallbackHref?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      aria-label="Go back"
      className={cx("flex h-10 w-10 items-center justify-center text-ink", className)}
    >
      <ChevronLeft size={22} strokeWidth={1.5} />
    </button>
  );
}
