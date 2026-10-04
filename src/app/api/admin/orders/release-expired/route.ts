import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { releaseExpiredOrders } from "@/lib/server/orders";

/** Settles online orders left unpaid past the payment window (run when the
    admin opens Orders, and on every checkout). */
export async function POST() {
  const { error } = await requireAdmin("orders.view");
  if (error) return error;
  return NextResponse.json({ settled: await releaseExpiredOrders() });
}
