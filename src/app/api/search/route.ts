import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/server/products";

// Public product search for the storefront search overlay.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const results = await searchProducts(q, 6);
  return NextResponse.json({
    results: results.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      fit: p.fit,
      image: p.images[0]?.src ?? null,
    })),
  });
}
