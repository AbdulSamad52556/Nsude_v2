import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { markPaid } from "@/lib/server/orders";
import { verifyWebhookSignature } from "@/lib/server/razorpay";

// Optional safety net: Razorpay calls this when a payment is captured, so
// an order is marked paid even if the visitor closed the tab right after
// paying. Set it up in Razorpay Dashboard → Webhooks with the URL
// https://<your-domain>/api/webhooks/razorpay, the "payment.captured" event,
// and a secret that you also put in RAZORPAY_WEBHOOK_SECRET.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id?: string } } };
  };
  const payment = event.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) {
    const order = await db.order.findFirst({ where: { razorpayOrderId: payment.order_id } });
    if (order) await markPaid(order, payment.id);
  }
  return NextResponse.json({ ok: true });
}
