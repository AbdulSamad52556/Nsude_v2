import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { getCustomer } from "@/lib/server/customer";
import { cancelOrder, giveBackStock, refreshCatalog, takeStock } from "@/lib/server/orders";
import { ownsOrder, productsByCode, toOrderSummary } from "@/lib/server/accountOrders";
import { customerActor, describeAddress, recordAudit, addressChanges, type Change } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { fieldErrors } from "@/lib/validation";
import { addressSchema, phoneSchema } from "@/lib/account";
import { CUSTOMER_EDITABLE_STATUS, MAX_LINE_QUANTITY, shippingFor } from "@/lib/checkout";
import { priceFor, SIZES } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { recordActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// What a customer can do to their own order before it's dispatched.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("address"), address: addressSchema }),
  z.object({
    action: z.literal("contact"),
    email: z.string().trim().toLowerCase().max(120).email("Enter a valid email address"),
    phone: phoneSchema,
  }),
  z.object({
    action: z.literal("items"),
    items: z
      .array(
        z.object({
          code: z.string().max(20),
          size: z.enum(SIZES),
          quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
        })
      )
      .min(1, "Keep at least one item — or cancel the order instead")
      .max(30),
  }),
  z.object({ action: z.literal("cancel") }),
]);

const lineLabel = (i: { name: string; color: string; size: string }) => `${i.name} (${i.color} · ${i.size})`;
const lineText = (i: { quantity: number; price: number }) => `${i.quantity} × ${formatPrice(i.price)}`;

export async function PATCH(request: NextRequest, { params }: Params) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const order = await db.order.findUnique({ where: { id: params.id } });
  if (!order || !ownsOrder(customer, order)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== CUSTOMER_EDITABLE_STATUS) {
    return NextResponse.json({ error: "This order has already been dispatched, so it can't be changed." }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const body = parsed.data;
  const actor = customerActor(customer.phone);
  const audit = (action: string, changes: Change[]) =>
    recordAudit({ actor, entity: "order", entityId: order.id, entityLabel: order.number, action, changes });

  // --- delivery address ------------------------------------------------------
  if (body.action === "address") {
    const address = { ...body.address, country: "India" };
    await db.order.update({ where: { id: order.id }, data: { address } });
    const changes = addressChanges(order.address, address);
    if (changes.length) {
      await audit("Delivery address changed by customer", [
        { field: "Ship to", from: describeAddress(order.address), to: describeAddress(address) },
        ...changes,
      ]);
    }
  }

  // --- contact details ---------------------------------------------------------
  if (body.action === "contact") {
    await db.order.update({ where: { id: order.id }, data: { email: body.email, phone: body.phone } });
    const changes: Change[] = [];
    if (order.email !== body.email) changes.push({ field: "Email", from: order.email, to: body.email });
    if (order.phone !== body.phone) changes.push({ field: "Mobile", from: `+91 ${order.phone}`, to: `+91 ${body.phone}` });
    if (changes.length) await audit("Contact details changed by customer", changes);
  }

  // --- sizes & quantities (cash on delivery only) -----------------------------
  if (body.action === "items") {
    if (order.paymentMethod !== "cod") {
      return NextResponse.json(
        { error: "Items on an order paid online can't be changed. You can cancel it for a refund instead." },
        { status: 409 }
      );
    }
    // Merge repeated code + size lines.
    const merged = new Map<string, { code: string; size: (typeof SIZES)[number]; quantity: number }>();
    for (const i of body.items) {
      const key = `${i.code}-${i.size}`;
      const prev = merged.get(key);
      merged.set(key, { ...i, quantity: (prev?.quantity ?? 0) + i.quantity });
    }
    const wanted = Array.from(merged.values());

    // Only colors that are already on the order.
    const original = new Map(order.items.map((i) => [`${i.code}-${i.size}`, i]));
    const orderedCodes = new Set(order.items.map((i) => i.code));
    if (wanted.some((w) => !orderedCodes.has(w.code))) {
      return NextResponse.json({ error: "Only items already on this order can be changed." }, { status: 400 });
    }
    const catalog = await productsByCode(wanted.map((w) => w.code));

    const lines = [];
    for (const w of wanted) {
      const before = original.get(`${w.code}-${w.size}`);
      if (before) {
        // Same item and size: keeps the price it was ordered at.
        lines.push({ ...before, quantity: w.quantity });
        continue;
      }
      const entry = catalog.get(w.code);
      if (!entry || !entry.product.sizes.includes(w.size) || entry.variant.unavailableSizes.includes(w.size)) {
        return NextResponse.json({ error: `Size ${w.size} isn't available in that color.` }, { status: 409 });
      }
      const template = order.items.find((i) => i.code === w.code)!;
      lines.push({ ...template, size: w.size, quantity: w.quantity, price: priceFor(entry.product, entry.variant, w.size) });
    }

    // Stock is per color: take more for increases, give back for decreases.
    const qtyByCode = (list: { code: string; quantity: number }[]) => {
      const m = new Map<string, number>();
      for (const l of list) m.set(l.code, (m.get(l.code) ?? 0) + l.quantity);
      return m;
    };
    const before = qtyByCode(order.items);
    const after = qtyByCode(lines);
    const more: { code: string; quantity: number }[] = [];
    const less: { code: string; quantity: number }[] = [];
    for (const code of Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))) {
      const delta = (after.get(code) ?? 0) - (before.get(code) ?? 0);
      if (delta > 0) more.push({ code, quantity: delta });
      if (delta < 0) less.push({ code, quantity: -delta });
    }
    if (more.length) {
      const taken = await takeStock(more);
      if (!taken.ok) {
        return NextResponse.json({ error: "Not enough stock for that change. Try a smaller quantity." }, { status: 409 });
      }
    }
    if (less.length) await giveBackStock(less);

    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const shipping = shippingFor(subtotal);
    await db.order.update({
      where: { id: order.id },
      data: { items: lines, subtotal, shipping, total: subtotal + shipping },
    });
    await refreshCatalog([...order.items, ...lines].map((l) => l.productId));

    // History: line by line, then the new total.
    const changes: Change[] = [];
    const afterMap = new Map(lines.map((l) => [`${l.code}-${l.size}`, l]));
    for (const [key, b] of Array.from(original)) {
      const a = afterMap.get(key);
      if (!a) changes.push({ field: lineLabel(b), from: lineText(b), to: "removed" });
      else if (a.quantity !== b.quantity) changes.push({ field: lineLabel(b), from: lineText(b), to: lineText(a) });
    }
    for (const [key, a] of Array.from(afterMap)) {
      if (!original.has(key)) changes.push({ field: lineLabel(a), from: "—", to: lineText(a) });
    }
    if (subtotal + shipping !== order.total) {
      changes.push({ field: "Total", from: formatPrice(order.total), to: formatPrice(subtotal + shipping) });
    }
    if (changes.length) await audit("Items changed by customer", changes);
  }

  // --- cancel -------------------------------------------------------------------
  if (body.action === "cancel") {
    const refund = order.paymentStatus === "paid";
    await cancelOrder(order, refund ? "refund_due" : undefined);
    await audit("Cancelled by customer", [
      { field: "Status", from: "Placed", to: "Cancelled" },
      { field: "Stock", from: "held", to: "returned to shop" },
      ...(refund ? [{ field: "Payment", from: "paid", to: "refund due" }] : []),
    ]);
  }

  await recordActivity(
    body.action === "cancel" ? "order_cancelled" : "order_edited",
    { order: order.number, change: body.action },
    { customerId: customer.id }
  );
  const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  const catalog = await productsByCode(updated.items.map((i) => i.code));
  return NextResponse.json({ order: toOrderSummary(updated, catalog) });
}
