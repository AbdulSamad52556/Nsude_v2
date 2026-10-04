import "server-only";
import { db } from "./db";
import type { AuditActor } from "./audit";
import type { StockReason } from "@/lib/inventory";

// Stock ledger: every change to a colourway's stock, with what was left
// after it. Written next to each stock change (orders, cancellations, order
// edits, product edits, inventory adjustments). Never throws: a logging
// problem must not undo the stock change itself.

type Line = { code: string; quantity: number };

function byCode(lines: Line[]) {
  const out = new Map<string, number>();
  for (const l of lines) out.set(l.code, (out.get(l.code) ?? 0) + l.quantity);
  return out;
}

/** The colourway with this code, and its product. */
export async function findColourway(code: string) {
  const product = await db.product.findFirst({ where: { variants: { some: { code } } } });
  const variant = product?.variants.find((v) => v.code === code);
  return product && variant ? { product, variant } : null;
}

/**
 * Records stock that has already moved: `direction` −1 for units taken
 * (sold), +1 for units put back.
 */
export async function logStockMovements(
  lines: Line[],
  direction: 1 | -1,
  ctx: { reason: StockReason; ref?: string; note?: string; actor: AuditActor }
) {
  for (const [code, quantity] of Array.from(byCode(lines))) {
    if (quantity === 0) continue;
    try {
      const found = await findColourway(code);
      if (!found) continue; // colour deleted since
      await db.stockMovement.create({
        data: {
          productId: found.product.id,
          productName: found.product.name,
          code,
          color: found.variant.name,
          change: direction * quantity,
          stockAfter: found.variant.stock,
          reason: ctx.reason,
          ref: ctx.ref ?? null,
          note: ctx.note ?? null,
          actorType: ctx.actor.type,
          actorLabel: ctx.actor.label,
        },
      });
    } catch (err) {
      console.error("Recording stock movement failed", err);
    }
  }
}

/** One movement with known before/after (product create / edit pages). */
export async function logStockChange(entry: {
  productId: string;
  productName: string;
  code: string;
  color: string;
  change: number;
  stockAfter: number;
  reason: StockReason;
  ref?: string;
  note?: string;
  actor: AuditActor;
}) {
  if (entry.change === 0) return;
  const { actor, ref, note, ...rest } = entry;
  try {
    await db.stockMovement.create({
      data: { ...rest, ref: ref ?? null, note: note ?? null, actorType: actor.type, actorLabel: actor.label },
    });
  } catch (err) {
    console.error("Recording stock movement failed", err);
  }
}
