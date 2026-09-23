"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { Product, Size } from "@/lib/types";
import { ProductGrid } from "@/components/product/ProductGrid";
import { cx } from "@/lib/utils";

type SortKey = "featured" | "newest" | "price-asc" | "price-desc";
type PriceBand = "all" | "under-1700" | "1700-2000" | "above-2000";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
];

const categories = ["All", "T-Shirts", "Long Sleeve"] as const;
const allSizes: Size[] = ["S", "M", "L", "XL", "XXL"];

const priceBands: { key: PriceBand; label: string }[] = [
  { key: "all", label: "All Prices" },
  { key: "under-1700", label: "Under ₹1,700" },
  { key: "1700-2000", label: "₹1,700 – ₹2,000" },
  { key: "above-2000", label: "Above ₹2,000" },
];

function FilterMenu({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "flex items-center gap-1.5 border-b border-transparent pb-1 text-xs uppercase tracking-widest2 transition-colors",
          active ? "text-ink" : "text-ash hover:text-graphite"
        )}
      >
        {label}
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          className={cx("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-20 mt-3 w-56 border border-graphite/15 bg-paper p-4 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function ShopView({ products }: { products: Product[] }) {
  const allColors = useMemo(
    () => Array.from(new Set(products.flatMap((p) => p.colors.map((c) => c.name)))),
    [products]
  );
  const searchParams = useSearchParams();
  const initialSort = (searchParams.get("sort") as SortKey) || "featured";

  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [size, setSize] = useState<Size | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [sort, setSort] = useState<SortKey>(initialSort);

  const filtered = useMemo(() => {
    let list = [...products];

    if (category !== "All") list = list.filter((p) => p.category === category);
    if (size) list = list.filter((p) => p.sizes.includes(size) && !p.unavailableSizes?.includes(size));
    if (color) list = list.filter((p) => p.colors.some((c) => c.name === color));
    if (priceBand === "under-1700") list = list.filter((p) => p.price < 1700);
    if (priceBand === "1700-2000") list = list.filter((p) => p.price >= 1700 && p.price <= 2000);
    if (priceBand === "above-2000") list = list.filter((p) => p.price > 2000);

    switch (sort) {
      case "newest":
        list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }

    return list;
  }, [products, category, size, color, priceBand, sort]);

  const hasActiveFilters = category !== "All" || size || color || priceBand !== "all";

  function clearFilters() {
    setCategory("All");
    setSize(null);
    setColor(null);
    setPriceBand("all");
  }

  return (
    <div className="mx-auto max-w-content px-5 pb-24 pt-32 md:px-10 md:pt-40">
      <div className="mb-12 flex flex-col gap-4 md:mb-16">
        <span className="text-xs uppercase tracking-widest2 text-ash">
          {filtered.length} Product{filtered.length === 1 ? "" : "s"}
        </span>
        <h1 className="text-display-lg font-medium uppercase tracking-tighter text-ink">
          Shop NSUDE
        </h1>
      </div>

      <div className="mb-12 flex flex-wrap items-center justify-between gap-6 border-y border-graphite/15 py-4">
        <div className="flex flex-wrap items-center gap-8">
          <FilterMenu label={`Category${category !== "All" ? `: ${category}` : ""}`} active={category !== "All"}>
            <ul className="flex flex-col gap-2">
              {categories.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cx(
                      "text-xs uppercase tracking-wide",
                      category === c ? "text-ink" : "text-ash hover:text-ink"
                    )}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </FilterMenu>

          <FilterMenu label={`Size${size ? `: ${size}` : ""}`} active={!!size}>
            <div className="grid grid-cols-3 gap-2">
              {allSizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(size === s ? null : s)}
                  className={cx(
                    "border py-2 text-xs uppercase tracking-wide transition-colors",
                    size === s ? "border-ink bg-ink text-bone" : "border-graphite/20 text-ink hover:border-ink"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </FilterMenu>

          <FilterMenu label={`Color${color ? `: ${color}` : ""}`} active={!!color}>
            <ul className="flex flex-col gap-2">
              {allColors.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => setColor(color === c ? null : c)}
                    className={cx(
                      "text-xs uppercase tracking-wide",
                      color === c ? "text-ink" : "text-ash hover:text-ink"
                    )}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </FilterMenu>

          <FilterMenu
            label={priceBands.find((b) => b.key === priceBand)?.label ?? "Price"}
            active={priceBand !== "all"}
          >
            <ul className="flex flex-col gap-2">
              {priceBands.map((b) => (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => setPriceBand(b.key)}
                    className={cx(
                      "text-xs uppercase tracking-wide",
                      priceBand === b.key ? "text-ink" : "text-ash hover:text-ink"
                    )}
                  >
                    {b.label}
                  </button>
                </li>
              ))}
            </ul>
          </FilterMenu>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
            >
              Clear <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <FilterMenu label={`Sort: ${sortOptions.find((o) => o.key === sort)?.label}`} active={sort !== "featured"}>
          <ul className="flex flex-col gap-2">
            {sortOptions.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => setSort(o.key)}
                  className={cx(
                    "text-xs uppercase tracking-wide",
                    sort === o.key ? "text-ink" : "text-ash hover:text-ink"
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </FilterMenu>
      </div>

      <ProductGrid products={filtered} />
    </div>
  );
}
