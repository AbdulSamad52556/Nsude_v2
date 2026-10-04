import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { FINANCE_TYPES, formatPaise, type FinanceType } from "@/lib/finance";

const schema = z.object({ voidReason: z.string().trim().min(3, "Say why").max(200) });

/**
 * Voids an entry made by mistake: it stays in the ledger, crossed out, but
 * no longer counts. COD cash, admin-order payments and refunds go back to
 * "to collect" / "due" on their order so they can be entered again.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await requireAdmin("finance.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Say why" }, { status: 400 });

  const entry = await db.financeEntry.findUnique({ where: { id: params.id } });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (entry.voidedAt) return NextResponse.json({ error: "Already voided." }, { status: 409 });
  if (entry.type === "order_payment") {
    return NextResponse.json(
      { error: "Online payments come from Razorpay and can't be voided. Add a correction instead." },
      { status: 400 }
    );
  }

  await db.financeEntry.update({
    where: { id: entry.id },
    data: { voidedAt: new Date(), voidedBy: admin.email, voidReason: parsed.data.voidReason },
  });
  if (entry.orderId && (entry.type === "cod_received" || entry.type === "order_received")) {
    await db.order.update({
      where: { id: entry.orderId },
      data: { moneyInAt: null, paymentStatus: entry.type === "cod_received" ? "cod" : "unpaid" },
    });
  }
  if (entry.orderId && entry.type === "refund") {
    await db.order.update({ where: { id: entry.orderId }, data: { refundedAt: null, paymentStatus: "refund_due" } });
  }

  const label = FINANCE_TYPES[entry.type as FinanceType]?.label ?? entry.type;
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "finance",
    entityId: entry.id,
    entityLabel: `${label} · ${formatPaise(entry.amount, { sign: true })}`,
    action: "Entry voided",
    changes: [
      { field: "Status", from: "Counted", to: "Voided" },
      { field: "Reason", from: "—", to: parsed.data.voidReason },
    ],
  });
  return NextResponse.json({ ok: true });
}
