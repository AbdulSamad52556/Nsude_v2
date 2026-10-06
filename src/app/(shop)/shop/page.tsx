import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { getShopPage } from "@/lib/server/listings";
import { productCategoryTree } from "@/lib/server/productCategories";
import { parseFilters } from "@/components/shop/filters";

export const metadata: Metadata = {
  title: "Shop All T-Shirts",
  description:
    "Browse the full NSUDE range of premium men's T-shirts — regular, relaxed, oversized, and boxy fits in heavyweight cotton.",
};

type SearchParams = Record<string, string | string[] | undefined>;

// Rendered per request from the URL's filters, but only the first page of
// results is fetched (from a cache that's cleared when the catalog changes),
// so the page stays small however large the catalog grows.
export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
  );
  const filters = parseFilters(params);
  const [initialPage, categories] = await Promise.all([getShopPage(filters, 1), productCategoryTree({ activeOnly: true })]);

  // Keyed by the filters so a client-side navigation to a different shop
  // URL starts fresh instead of keeping the old results.
  return <ShopView key={params.toString()} initialFilters={filters} initialPage={initialPage} categories={categories} />;
}
