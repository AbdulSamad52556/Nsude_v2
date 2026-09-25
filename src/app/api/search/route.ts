import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/server/products";
import { priceRange, productHref } from "@/lib/types";

// Public product search for the storefront search overlay.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const results = await searchProducts(q, 6);
  return NextResponse.json({
    results: results.map(({ product, variant }) => ({
      id: variant.code,
      name: product.name,
      color: variant.name,
      href: productHref(variant),
      priceRange: priceRange(product, [variant]),
      fit: product.fit,
      image: variant.images[0]?.src ?? null,
    })),
  });
}
