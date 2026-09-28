import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { NEXT_STATUSES, cancelOrder, settleUnpaidOrder } from "@/lib/server/orders";
import { isObjectId } from "@/lib/server/revalidate";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/checkout";

type Params = { params: { id: string } };

const schema = z.object({ status: z.enum(ORDER_STATUSES) });

/** Moves an order along: placed → shipped → delivered, or cancelled
    (which puts its stock back on sale). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const next = parsed.data.status;

  const order = await db.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!NEXT_STATUSES[order.status as OrderStatus].includes(next)) {
    return NextResponse.json({ error: `Can't change a ${order.status} order to ${next}` }, { status: 409 });
  }

  if (next === "cancelled") {
    // An unpaid online order may have been paid a moment ago: check first.
    if (order.status === "pending_payment") {
      const settled = await settleUnpaidOrder(order);
      if (settled === "placed") {
        return NextResponse.json({ error: "This order was just paid, so it wasn't cancelled." }, { status: 409 });
      }
      if (settled === null) {
        return NextResponse.json({ error: "Couldn't reach Razorpay to check this payment. Try again." }, { status: 502 });
      }
    } else {
      await cancelOrder(order);
    }
  } else {
    await db.order.update({
      where: { id: order.id },
      data: {
        status: next,
        // Cash on delivery is collected when the parcel is delivered.
        ...(next === "delivered" && order.paymentMethod === "cod" ? { paymentStatus: "paid" } : {}),
      },
    });
  }
  return NextResponse.json({ ok: true });
}
