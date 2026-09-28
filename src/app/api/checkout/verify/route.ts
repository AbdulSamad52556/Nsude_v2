import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { markPaid } from "@/lib/server/orders";
import { verifyPaymentSignature } from "@/lib/server/razorpay";
import { rateLimit } from "@/lib/server/rateLimit";

// Called by the checkout page after the Razorpay popup reports success.
// The signature proves the payment came from Razorpay for this order.
export const dynamic = "force-dynamic";

const schema = z.object({
  number: z.string().max(20),
  razorpay_order_id: z.string().max(100),
  razorpay_payment_id: z.string().max(100),
  razorpay_signature: z.string().max(200),
});

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "verify", 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { number, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Payment couldn't be verified" }, { status: 400 });
  }
  const order = await db.order.findFirst({ where: { number, razorpayOrderId: razorpay_order_id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const updated = await markPaid(order, razorpay_payment_id);
  return NextResponse.json({ number: updated.number, status: updated.status, total: updated.total });
}
