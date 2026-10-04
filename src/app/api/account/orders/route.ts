import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getCustomer } from "@/lib/server/customer";
import { productsByCode, toOrderSummary } from "@/lib/server/accountOrders";

export const dynamic = "force-dynamic";

/**
 * The signed-in customer's orders, newest first: orders placed while signed
 * in, plus earlier guest orders with the same (OTP-verified) phone number.
 * Each says what the customer may still change (until it's dispatched).
 */
export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const orders = await db.order.findMany({
    where: {
      OR: [{ customerId: customer.id }, { phone: customer.phone }],
      // Online orders that were never paid aren't real orders.
      NOT: { status: "pending_payment" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Size options are only needed for orders whose items can still change.
  const editableCodes = orders
    .filter((o) => o.status === "placed" && o.paymentMethod === "cod")
    .flatMap((o) => o.items.map((i) => i.code));
  const catalog = await productsByCode(editableCodes);

  return NextResponse.json({ orders: orders.map((o) => toOrderSummary(o, catalog)) });
}
