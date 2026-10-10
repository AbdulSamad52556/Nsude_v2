import "server-only";
import type { Customer, Order } from "@prisma/client";
import { db } from "./db";
import { toProduct } from "./products";
import { priceFor, type Product, type Size } from "@/lib/types";
import { CUSTOMER_EDITABLE_STATUS } from "@/lib/checkout";

/** Is this order the signed-in customer's (placed while signed in, or as a
    guest with the same verified number)? */
export const ownsOrder = (customer: Customer, order: Order) =>
  order.customerId === customer.id || order.phone === customer.phone;

export interface SizeOption {
  size: Size;
  price: number;
  available: boolean;
}

/** The current catalog entry behind each colorway code (for size options). */
export async function productsByCode(codes: string[]) {
  const unique = Array.from(new Set(codes));
  if (unique.length === 0) return new Map<string, { product: Product; variant: Product["variants"][number] }>();
  const rows = await db.product.findMany({ where: { variants: { some: { code: { in: unique } } } } });
  return new Map(
    rows.flatMap((row) => {
      const product = toProduct(row);
      return product.variants.map((variant) => [variant.code, { product, variant }] as const);
    })
  );
}

/** What the account page shows for one order, including what can be changed. */
export function toOrderSummary(order: Order, catalog: Awaited<ReturnType<typeof productsByCode>>) {
  // Orders entered by the shop (phone / in-person) are changed by the shop only.
  const editable = order.status === CUSTOMER_EDITABLE_STATUS && !order.createdBy;
  // Items can be changed only on cash-on-delivery orders (no payment to
  // adjust), and not once a custom print is on the order (it may already be
  // in production; the order can still be cancelled).
  const itemsEditable = editable && order.paymentMethod === "cod" && !order.items.some((i) => i.designId);
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt.toISOString(),
    total: order.total,
    subtotal: order.subtotal,
    shipping: order.shipping,
    email: order.email,
    phone: order.phone,
    editable,
    itemsEditable,
    items: order.items.map((i) => {
      const entry = itemsEditable ? catalog.get(i.code) : undefined;
      // Sizes the customer could switch to: this item's own size always,
      // other sizes if made and not sold out (priced as they are now).
      const sizeOptions: SizeOption[] = entry
        ? entry.product.sizes.map((size) => ({
            size,
            price: size === i.size ? i.price : priceFor(entry.product, entry.variant, size),
            available: size === i.size || (!entry.variant.unavailableSizes.includes(size) && entry.variant.stock > 0),
          }))
        : [];
      return {
        code: i.code,
        name: i.name,
        color: i.color,
        size: i.size,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
        design: i.design ?? null,
        sizeOptions,
      };
    }),
    address: order.address,
  };
}
export type OrderSummary = ReturnType<typeof toOrderSummary>;
