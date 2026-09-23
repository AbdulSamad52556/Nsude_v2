import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";

export const metadata: Metadata = {
  title: "Shop All T-Shirts",
  description:
    "Browse the full NSUDE range of premium men's T-shirts — regular, relaxed, oversized, and boxy fits in heavyweight cotton.",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopView />
    </Suspense>
  );
}
