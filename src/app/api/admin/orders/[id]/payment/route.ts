import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { entryDate, recordOrderMoneyIn, recordOrderRefund } from "@/lib/server/finance";

const schema = z.object({
  action: z.enum(["cash_received", "paid", "refunded"]),
  method: z.enum(["cash", "upi", "bank", "card", "razorpay"]),
  reference: z.string().trim().max(100).optional(),
  date: z.string().max(10).optional(),
});

/**
 * An order's money: COD cash has reached the company, an admin-entered order
 * was paid, or a refund has been paid back. Each is entered in Finance.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await requireAdmin(["orders.manage", "finance.manage"]);
  if (error) return error;
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose how the money moved." }, { status: 400 });
  const { action, method, reference, date } = parsed.data;

  const order = await db.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const actor = adminActor(admin.email);

  if (action === "cash_received") {
    if (order.paymentMethod !== "cod" || order.status === "cancelled" || order.status === "pending_payment") {
      return NextResponse.json({ error: "Only open cash-on-delivery orders take cash." }, { status: 409 });
    }
    const done = await recordOrderMoneyIn(order, { type: "cod_received", by: actor, method, reference, at: entryDate(date) });
    if (!done) return NextResponse.json({ error: "This order's money is already in Finance." }, { status: 409 });
    await recordAudit({
      actor,
      entity: "order",
      entityId: order.id,
      entityLabel: order.number,
      action: "Cash received",
      changes: [{ field: "Payment", from: "Cash on delivery", to: `Paid (${method})` }],
    });
  } else if (action === "paid") {
    if (order.paymentMethod !== "offline" || order.status === "cancelled" || order.paymentStatus === "paid") {
      return NextResponse.json({ error: "Only unpaid admin orders can be marked paid here." }, { status: 409 });
    }
    const done = await recordOrderMoneyIn(order, { type: "order_received", by: actor, method, reference, at: entryDate(date) });
    if (!done) return NextResponse.json({ error: "This order's money is already in Finance." }, { status: 409 });
    await recordAudit({
      actor,
      entity: "order",
      entityId: order.id,
      entityLabel: order.number,
      action: "Payment received",
      changes: [{ field: "Payment", from: "Not paid yet", to: `Paid (${method})` }],
    });
  } else {
    if (order.paymentStatus !== "refund_due") {
      return NextResponse.json({ error: "This order has no refund due." }, { status: 409 });
    }
    const done = await recordOrderRefund(order, { by: actor, method, reference, at: entryDate(date) });
    if (!done) return NextResponse.json({ error: "This refund is already in Finance." }, { status: 409 });
    await recordAudit({
      actor,
      entity: "order",
      entityId: order.id,
      entityLabel: order.number,
      action: "Refund paid",
      changes: [{ field: "Payment", from: "Refund due", to: `Refunded (${method})` }],
    });
  }
  return NextResponse.json({ ok: true });
}
