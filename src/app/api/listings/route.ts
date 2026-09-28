import { NextResponse, type NextRequest } from "next/server";
import { getShopPage } from "@/lib/server/listings";
import { parseFilters } from "@/components/shop/filters";

// Shop results for the given filters: one page of cards plus the filter
// option counts. Used by the shop page when filters change or on
// "Load more"; the first page is rendered on the server.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = parseFilters(params);
  const page = Number(params.get("page") ?? "1");
  const data = await getShopPage(filters, page);
  return NextResponse.json(data, {
    // Results only change when an admin saves; let the browser/CDN reuse
    // them briefly and revalidate in the background.
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
