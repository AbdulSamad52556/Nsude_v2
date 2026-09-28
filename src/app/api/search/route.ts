import { NextResponse, type NextRequest } from "next/server";
import { searchCards } from "@/lib/server/listings";
import { productHref } from "@/lib/types";

// Public product search for the storefront search overlay. Queries the
// lean Listing collection (card fields only, max 6 results) and caches
// each query until the catalog changes.
export const dynamic = "force-dynamic";

// Keep in sync with SearchOverlay (route files can only export handlers).
const MIN_QUERY_LENGTH = 2;

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json({ results: [] });

  const cards = await searchCards(q, 6);
  return NextResponse.json(
    {
      results: cards.map((c) => ({
        id: c.code,
        name: c.name,
        color: c.colorName,
        href: productHref(c),
        priceRange: c.price,
        fit: c.fit,
        image: c.images[0]?.src ?? null,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } }
  );
}
