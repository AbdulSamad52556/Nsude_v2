import { NextResponse, type NextRequest } from "next/server";
import { priceCart } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rateLimit";
import { cartItemsSchema } from "@/lib/checkout";

// Prices the visitor's bag from the catalog for the checkout summary, and
// flags anything sold out or short on stock before they try to pay.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "quote", 120, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = cartItemsSchema.safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Your bag is empty or invalid" }, { status: 400 });

  return NextResponse.json(await priceCart(parsed.data));
}
