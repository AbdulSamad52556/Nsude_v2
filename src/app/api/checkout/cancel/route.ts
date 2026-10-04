import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { settleUnpaidOrder } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rateLimit";
import { recordActivity } from "@/lib/server/activity";

// Called when the visitor closes the Razorpay popup without paying: unless
// Razorpay did take a payment, the order is cancelled and its stock goes
// straight back on sale. Needs the Razorpay order id, which only the
// visitor who started this payment has.
export const dynamic = "force-dynamic";

const schema = z.object({ number: z.string().max(20), razorpayOrderId: z.string().max(100) });

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "cancel", 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const order = await db.order.findFirst({
    where: { number: parsed.data.number, razorpayOrderId: parsed.data.razorpayOrderId },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const status = await settleUnpaidOrder(order);
  await recordActivity("payment_cancelled", { order: order.number });
  return NextResponse.json({ number: order.number, status: status ?? order.status, total: order.total });
}
