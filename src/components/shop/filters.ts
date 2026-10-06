// Shop filter model, shared by the shop page (browser) and the listings
// query (server): the filter shape and how it maps to/from the URL.
// Matching, sorting and counting happen in the database — see
// src/lib/server/listings.ts.
import { FITS, SIZES, type Fit, type Size } from "@/lib/types";

export type SortKey = "featured" | "newest" | "price-asc" | "price-desc";
export type PriceBand = "under-1700" | "1700-2000" | "above-2000";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
];

/** Price ranges, applied to a colorway's starting ("From") price. */
export const PRICE_BANDS: { key: PriceBand; label: string }[] = [
  { key: "under-1700", label: "Under ₹1,700" },
  { key: "1700-2000", label: "₹1,700 – ₹2,000" },
  { key: "above-2000", label: "Above ₹2,000" },
];

export interface Filters {
  /** Category URL key, e.g. "t-shirts" (see categoryKey). */
  category: string | null;
  /** Sub-category URL key within it, e.g. "graphic". */
  subcategory: string | null;
  fits: Fit[];
  sizes: Size[];
  /** Color keys (see colorKey), e.g. "off-white". */
  colors: string[];
  price: PriceBand | null;
  inStock: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  category: null,
  subcategory: null,
  fits: [],
  sizes: [],
  colors: [],
  price: null,
  inStock: false,
  sort: "featured",
};

const slug = (v: string) => v.toLowerCase().replace(/\s+/g, "-");

/** URL-safe key for a color name ("Off-White" → "off-white"). */
export const colorKey = slug;

type ParamSource = { get(name: string): string | null };

/** Read filters from the URL, ignoring anything unknown. */
export function parseFilters(params: ParamSource): Filters {
  const list = (key: string) => (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Keys only (categories are managed in admin, so any well-formed key).
  const key = (v: string | null) => (v && /^[a-z0-9-]{1,60}$/.test(v) ? v : null);
  const category = key(params.get("category"));
  const subcategory = category ? key(params.get("sub")) : null;
  const fits = FITS.filter((f) => list("fit").includes(slug(f)));
  const sizes = SIZES.filter((s) => list("size").includes(s.toLowerCase()));
  const price = PRICE_BANDS.find((b) => b.key === params.get("price"))?.key ?? null;
  const sort = SORT_OPTIONS.find((o) => o.key === params.get("sort"))?.key ?? "featured";
  return {
    category,
    subcategory,
    fits,
    sizes,
    // Keys only — lowercase letters, digits and hyphens; at most 20.
    colors: list("color").map((c) => c.toLowerCase()).filter((c) => /^[a-z0-9-]{1,40}$/.test(c)).slice(0, 20),
    price,
    inStock: params.get("stock") === "1",
    sort,
  };
}

/** Filters → query string (empty values omitted, so the URL stays short). */
export function filtersToQuery(f: Filters) {
  const q = new URLSearchParams();
  if (f.category) q.set("category", f.category);
  if (f.category && f.subcategory) q.set("sub", f.subcategory);
  if (f.fits.length) q.set("fit", f.fits.map(slug).join(","));
  if (f.sizes.length) q.set("size", f.sizes.map((s) => s.toLowerCase()).join(","));
  if (f.colors.length) q.set("color", f.colors.join(","));
  if (f.price) q.set("price", f.price);
  if (f.inStock) q.set("stock", "1");
  if (f.sort !== "featured") q.set("sort", f.sort);
  return q.toString();
}

/** Number of active filters (sort doesn't count). */
export function activeFilterCount(f: Filters) {
  return (
    (f.category ? 1 : 0) +
    (f.subcategory ? 1 : 0) +
    f.fits.length +
    f.sizes.length +
    f.colors.length +
    (f.price ? 1 : 0) +
    (f.inStock ? 1 : 0)
  );
}
