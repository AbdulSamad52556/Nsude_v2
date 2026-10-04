import "server-only";
import { Prisma, type Order } from "@prisma/client";
import { db } from "./db";
import { toProduct } from "./products";
import { syncProductListings } from "./listings";
import { revalidateStorefront } from "./revalidate";
import { findSuccessfulPayment } from "./razorpay";
import { recordAudit, systemActor } from "./audit";
import { priceFor, type Size } from "@/lib/types";
import { randomCode } from "@/lib/codes";
import { shippingFor, type OrderStatus } from "@/lib/checkout";

/** An unpaid Razorpay order holds its stock this long before it's released. */
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

export interface CartItem {
  code: string;
  size: Size;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  code: string;
  name: string;
  color: string;
  size: Size;
  price: number;
  quantity: number;
  image: string;
}

export interface CartIssue {
  code: string;
  size: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Pricing: the server's view of a bag
// ---------------------------------------------------------------------------

/**
 * Prices a bag from the catalog (never from the browser) and reports
 * anything that can't be bought as asked: removed colors, sold-out sizes,
 * or more than the color has in stock (stock is per color, shared by its
 * sizes).
 */
export async function priceCart(items: CartItem[]) {
  // Merge repeated code + size lines.
  const merged = new Map<string, CartItem>();
  for (const item of items) {
    const key = `${item.code}-${item.size}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + item.quantity } : { ...item });
  }

  const codes = Array.from(new Set(items.map((i) => i.code)));
  const rows = await db.product.findMany({ where: { variants: { some: { code: { in: codes } } } } });
  const byCode = new Map(
    rows.flatMap((row) => {
      const product = toProduct(row);
      return product.variants.map((variant) => [variant.code, { product, variant }] as const);
    })
  );

  const lines: PricedLine[] = [];
  const issues: CartIssue[] = [];
  const wanted = new Map<string, number>();

  for (const item of Array.from(merged.values())) {
    const found = byCode.get(item.code);
    if (!found) {
      issues.push({ code: item.code, size: item.size, message: "This item is no longer available" });
      continue;
    }
    const { product, variant } = found;
    if (!product.sizes.includes(item.size) || variant.unavailableSizes.includes(item.size) || variant.stock === 0) {
      issues.push({ code: item.code, size: item.size, message: `${variant.name} / ${item.size} is sold out` });
      continue;
    }
    wanted.set(item.code, (wanted.get(item.code) ?? 0) + item.quantity);
    lines.push({
      productId: product.id,
      code: variant.code,
      name: product.name,
      color: variant.name,
      size: item.size,
      price: priceFor(product, variant, item.size),
      quantity: item.quantity,
      image: variant.images[0]?.src ?? "",
    });
  }

  for (const [code, quantity] of Array.from(wanted)) {
    const { variant } = byCode.get(code)!;
    if (quantity > variant.stock) {
      for (const line of lines.filter((l) => l.code === code)) {
        issues.push({
          code,
          size: line.size,
          message: `Only ${variant.stock} left in ${variant.name} — reduce the quantity`,
        });
      }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shipping = shippingFor(subtotal);
  return { lines, issues, subtotal, shipping, total: subtotal + shipping };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

function quantitiesByCode(lines: { code: string; quantity: number }[]) {
  const out = new Map<string, number>();
  for (const l of lines) out.set(l.code, (out.get(l.code) ?? 0) + l.quantity);
  return out;
}

/** Atomically moves stock of one color by `delta`; a decrease only happens
    if enough is left. Returns whether the document changed. */
async function adjustStock(code: string, delta: number) {
  const variantMatch = delta < 0 ? { code, stock: { $gte: -delta } } : { code };
  const result = (await db.$runCommandRaw({
    update: "Product",
    updates: [
      {
        q: { variants: { $elemMatch: variantMatch } },
        u: { $inc: { "variants.$[v].stock": delta } },
        arrayFilters: [{ "v.code": code }],
      },
    ],
  })) as { nModified?: number };
  return (result.nModified ?? 0) > 0;
}

/**
 * Takes stock for every line, all or nothing: if any color doesn't have
 * enough left (someone bought it a moment ago), whatever was taken is put
 * back and the color is returned.
 */
export async function takeStock(lines: { code: string; quantity: number }[]) {
  const taken: [string, number][] = [];
  for (const [code, quantity] of Array.from(quantitiesByCode(lines))) {
    if (await adjustStock(code, -quantity)) {
      taken.push([code, quantity]);
    } else {
      for (const [c, q] of taken) await adjustStock(c, q);
      return { ok: false as const, code };
    }
  }
  return { ok: true as const };
}

export async function giveBackStock(lines: { code: string; quantity: number }[]) {
  // A color deleted since the order simply doesn't match; nothing to restore.
  for (const [code, quantity] of Array.from(quantitiesByCode(lines))) await adjustStock(code, quantity);
}

/** After stock changes: rebuild those products' shop listings (sold-out
    state) and refresh cached storefront pages. Route handlers only. */
export async function refreshCatalog(productIds: string[]) {
  for (const id of Array.from(new Set(productIds))) await syncProductListings(id);
  revalidateStorefront();
}

// ---------------------------------------------------------------------------
// Order lifecycle
// ---------------------------------------------------------------------------

/** "NS-" + 6 letters/digits; uniqueness is enforced by the index. */
export const newOrderNumber = () => `NS-${randomCode(6)}`;

/** Retries `create` with a fresh order number on the rare duplicate. */
export async function withUniqueNumber<T>(create: (number: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(newOrderNumber());
    } catch (err) {
      const duplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!duplicate || attempt >= 4) throw err;
    }
  }
}

/** Gives an order's stock back, exactly once, however many callers race. */
async function releaseStock(order: Order) {
  const { count } = await db.order.updateMany({ where: { id: order.id, stockHeld: true }, data: { stockHeld: false } });
  if (count === 0) return false;
  await giveBackStock(order.items);
  return true;
}

/**
 * Records a successful Razorpay payment. Normally the order is waiting for
 * it; if it had already been given up on (payment landed after the window),
 * it's revived and its stock taken again if still available.
 */
export async function markPaid(order: Order, razorpayPaymentId: string) {
  if (order.paymentStatus === "paid") return order;

  if (order.status === "pending_payment") {
    await db.order.updateMany({
      where: { id: order.id, status: "pending_payment" },
      data: { status: "placed", paymentStatus: "paid", razorpayPaymentId },
    });
  } else if (order.status === "cancelled") {
    const taken = await takeStock(order.items);
    await db.order.update({
      where: { id: order.id },
      data: { status: "placed", paymentStatus: "paid", razorpayPaymentId, stockHeld: taken.ok },
    });
    if (taken.ok) await refreshCatalog(order.items.map((i) => i.productId));
  }
  const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  if (updated.paymentStatus === "paid" && order.paymentStatus !== "paid") {
    await recordAudit({
      actor: systemActor("Razorpay payment"),
      entity: "order",
      entityId: order.id,
      entityLabel: order.number,
      action: "Payment received",
      changes: [
        { field: "Status", from: order.status, to: updated.status },
        { field: "Payment", from: order.paymentStatus, to: "paid" },
        { field: "Razorpay payment", from: "—", to: razorpayPaymentId },
      ],
    });
  }
  return updated;
}

/** Cancels an order and returns its stock to the shop. */
export async function cancelOrder(order: Order, paymentStatus?: string) {
  const released = await releaseStock(order);
  await db.order.update({
    where: { id: order.id },
    data: { status: "cancelled", ...(paymentStatus ? { paymentStatus } : {}) },
  });
  if (released) await refreshCatalog(order.items.map((i) => i.productId));
}

/**
 * Settles an unpaid Razorpay order: if Razorpay has a payment for it, it's
 * paid; otherwise it's cancelled and its stock released. Returns the new
 * status, or null if Razorpay couldn't be reached (left for a later try).
 */
export async function settleUnpaidOrder(order: Order): Promise<OrderStatus | null> {
  const result = await settleUnpaidOrderInner(order);
  if (result === "cancelled" && order.status === "pending_payment") {
    await recordAudit({
      actor: systemActor("Payment check"),
      entity: "order",
      entityId: order.id,
      entityLabel: order.number,
      action: "Unpaid order cancelled",
      changes: [
        { field: "Status", from: "Awaiting payment", to: "Cancelled" },
        { field: "Stock", from: "held", to: "returned to shop" },
      ],
    });
  }
  return result;
}

async function settleUnpaidOrderInner(order: Order): Promise<OrderStatus | null> {
  if (order.status !== "pending_payment") return order.status as OrderStatus;
  if (order.razorpayOrderId) {
    try {
      const payment = await findSuccessfulPayment(order.razorpayOrderId);
      if (payment) return (await markPaid(order, payment.id)).status as OrderStatus;
    } catch (err) {
      console.error("Couldn't check Razorpay payment for order", order.number, err);
      return null;
    }
  }
  await cancelOrder(order, "failed");
  return "cancelled";
}

/** Settles Razorpay orders left unpaid past the payment window (visitor
    closed the tab, payment failed…) so their stock goes back on sale. */
export async function releaseExpiredOrders() {
  const expired = await db.order.findMany({
    where: { status: "pending_payment", createdAt: { lt: new Date(Date.now() - PAYMENT_WINDOW_MS) } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  let settled = 0;
  for (const order of expired) if (await settleUnpaidOrder(order)) settled++;
  return settled;
}

/** Status changes the admin can make: forward along the shipping flow, or
    cancel anything not yet delivered. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["cancelled"],
  placed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
