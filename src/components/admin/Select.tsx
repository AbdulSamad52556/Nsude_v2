import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/utils";

/** Native select with the browser's arrow replaced by our own, inset from
    the edge so it lines up with the input padding across browsers. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={cx(
            "h-11 w-full cursor-pointer appearance-none border border-graphite/20 bg-transparent pl-3 pr-11 text-sm focus:border-ink focus:outline-none",
            className
          )}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-graphite"
        />
      </div>
    );
  }
);
