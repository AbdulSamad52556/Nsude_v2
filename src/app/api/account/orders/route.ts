import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getCustomer } from "@/lib/server/customer";

export const dynamic = "force-dynamic";

/**
 * The signed-in customer's orders, newest first: orders placed while signed
 * in, plus earlier guest orders with the same (OTP-verified) phone number.
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

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      total: o.total,
      subtotal: o.subtotal,
      shipping: o.shipping,
      items: o.items.map((i) => ({
        code: i.code,
        name: i.name,
        color: i.color,
        size: i.size,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      })),
      address: o.address,
    })),
  });
}
