import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { adjustStock, refreshCatalog } from "@/lib/server/orders";
import { findColourway, logStockChange } from "@/lib/server/stockLedger";
import { MANUAL_STOCK_REASONS, STOCK_REASONS } from "@/lib/inventory";

const schema = z.object({
  code: z.string().min(1).max(20),
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.number().int().min(0).max(100000),
  reason: z.enum(MANUAL_STOCK_REASONS),
  ref: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Restock, write off or correct one colour's stock, with a reason. */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("inventory.manage");
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the quantity and reason." }, { status: 400 });
  const { code, mode, quantity, reason, ref, note } = parsed.data;

  const found = await findColourway(code);
  if (!found) return NextResponse.json({ error: "That colour no longer exists." }, { status: 404 });
  const before = found.variant.stock;
  const delta = mode === "add" ? quantity : mode === "remove" ? -quantity : quantity - before;
  if (delta === 0) return NextResponse.json({ error: "That doesn't change the stock." }, { status: 400 });
  // Atomic, and never below zero (an order may have taken stock meanwhile).
  if (!(await adjustStock(code, delta))) {
    return NextResponse.json({ error: `Only ${before} in stock — can't remove ${-delta}.` }, { status: 409 });
  }

  const after = (await findColourway(code))?.variant.stock ?? before + delta;
  const actor = adminActor(admin.email);
  await logStockChange({
    productId: found.product.id,
    productName: found.product.name,
    code,
    color: found.variant.name,
    change: delta,
    stockAfter: after,
    reason,
    ref,
    note,
    actor,
  });
  await recordAudit({
    actor,
    entity: "product",
    entityId: found.product.id,
    entityLabel: found.product.name,
    action: "Stock adjusted",
    changes: [
      { field: `Stock · ${found.variant.name} (${code})`, from: String(before), to: String(after) },
      { field: "Reason", from: "—", to: STOCK_REASONS[reason] },
      ...(ref ? [{ field: "Reference", from: "—", to: ref }] : []),
      ...(note ? [{ field: "Note", from: "—", to: note }] : []),
    ],
  });
  await refreshCatalog([found.product.id]);
  return NextResponse.json({ stock: after });
}
