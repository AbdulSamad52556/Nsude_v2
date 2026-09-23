import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { getProducts } from "@/lib/server/products";

export const metadata: Metadata = {
  title: "Shop All T-Shirts",
  description:
    "Browse the full NSUDE range of premium men's T-shirts — regular, relaxed, oversized, and boxy fits in heavyweight cotton.",
};

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <Suspense fallback={null}>
      <ShopView products={products} />
    </Suspense>
  );
}
