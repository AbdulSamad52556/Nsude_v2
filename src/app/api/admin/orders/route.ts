import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, describeAddress, recordAudit } from "@/lib/server/audit";
import { giveBackStock, priceCart, refreshCatalog, takeStock, withUniqueNumber } from "@/lib/server/orders";
import { logStockMovements } from "@/lib/server/stockLedger";
import { entryDate, recordOrderMoneyIn } from "@/lib/server/finance";
import { INDIAN_STATES, cartItemsSchema } from "@/lib/checkout";
import { fieldErrors } from "@/lib/validation";

const text = (label: string, max = 80) => z.string().trim().min(1, `Enter the ${label}`).max(max);

const schema = z
  .object({
    firstName: text("first name", 50),
    lastName: z.string().trim().max(50).default(""),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
      .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email").max(120)]).default(""),
    /** false = handed over in person; no delivery address. */
    delivery: z.boolean(),
    line1: z.string().trim().max(160).default(""),
    line2: z.string().trim().max(160).default(""),
    city: z.string().trim().max(60).default(""),
    state: z.string().max(60).default(""),
    pincode: z.string().trim().max(6).default(""),
    items: cartItemsSchema,
    /** Whole rupees; the usual shipping rule when left out. */
    shipping: z.number().int().min(0).max(100000).optional(),
    discount: z.number().int().min(0).max(10000000).default(0),
    paid: z.boolean(),
    method: z.enum(["cash", "upi", "bank", "card"]).default("cash"),
    reference: z.string().trim().max(100).optional(),
    date: z.string().max(10).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((b, ctx) => {
    if (!b.delivery) return;
    if (!b.line1) ctx.addIssue({ code: "custom", path: ["line1"], message: "Enter the address" });
    if (!b.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Enter the city" });
    if (!(INDIAN_STATES as readonly string[]).includes(b.state)) ctx.addIssue({ code: "custom", path: ["state"], message: "Select the state" });
    if (!/^[1-9]\d{5}$/.test(b.pincode)) ctx.addIssue({ code: "custom", path: ["pincode"], message: "Enter a valid 6-digit PIN code" });
  });

/**
 * An order entered by an admin (phone, Instagram, in-person sale). Priced
 * from the catalogue like a website order and takes stock the same way.
 * Paid now → the money goes into Finance; not paid → it waits under
 * "to collect" until someone marks it paid.
 */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("orders.manage");
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const b = parsed.data;

  // The shop may also sell plain blank tees in person.
  const quote = await priceCart(b.items, { allowPlainBlanks: true });
  if (quote.issues.length) {
    return NextResponse.json({ error: quote.issues.map((i) => i.message).join(" · ") }, { status: 409 });
  }
  const shipping = b.delivery ? (b.shipping ?? quote.shipping) : 0;
  if (b.discount > quote.subtotal + shipping) {
    return NextResponse.json({ error: "The discount is more than the order.", fields: { discount: "Too much" } }, { status: 400 });
  }
  const total = quote.subtotal + shipping - b.discount;

  const taken = await takeStock(quote.lines);
  if (!taken.ok) return NextResponse.json({ error: "Something just sold out. Check the items." }, { status: 409 });

  // The customer's account, if they have one with this number.
  const customer = await db.customer.findUnique({ where: { phone: b.phone }, select: { id: true } });
  const address = b.delivery
    ? { firstName: b.firstName, lastName: b.lastName, line1: b.line1, line2: b.line2, city: b.city, state: b.state, pincode: b.pincode, country: "India" }
    : { firstName: b.firstName, lastName: b.lastName, line1: "Handed over in person", line2: "", city: "", state: "", pincode: "", country: "India" };

  const order = await withUniqueNumber((number) =>
    db.order.create({
      data: {
        number,
        status: "placed",
        paymentMethod: "offline",
        paymentStatus: "unpaid",
        items: quote.lines,
        subtotal: quote.subtotal,
        shipping,
        discount: b.discount || null,
        total,
        email: b.email,
        phone: b.phone,
        address,
        stockHeld: true,
        customerId: customer?.id ?? null,
        createdBy: admin.email,
        note: b.note || null,
      },
    })
  ).catch(async (err) => {
    await giveBackStock(quote.lines);
    throw err;
  });

  const actor = adminActor(admin.email);
  await logStockMovements(quote.lines, -1, { reason: "sale", ref: order.number, actor });
  await refreshCatalog(quote.lines.map((l) => l.productId));
  await recordAudit({
    actor,
    entity: "order",
    entityId: order.id,
    entityLabel: order.number,
    action: "Order created by admin",
    changes: [
      ...quote.lines.map((l) => ({
        field: `Item · ${l.name} (${l.color} · ${l.size})`,
        from: "—",
        to: `${l.quantity} × ₹${l.price.toLocaleString("en-IN")}`,
      })),
      ...(b.discount ? [{ field: "Discount", from: "—", to: `₹${b.discount.toLocaleString("en-IN")}` }] : []),
      { field: "Total", from: "—", to: `₹${total.toLocaleString("en-IN")}` },
      { field: "Customer", from: "—", to: `${b.firstName} ${b.lastName} · +91 ${b.phone}`.trim() },
      { field: "Delivery", from: "—", to: b.delivery ? describeAddress(address) : "Handed over in person" },
      { field: "Payment", from: "—", to: b.paid ? `Paid (${b.method})` : "Not paid yet" },
    ],
  });

  // Paid now: the money goes into Finance straight away.
  if (b.paid) {
    await recordOrderMoneyIn(order, { type: "order_received", by: actor, method: b.method, reference: b.reference, at: entryDate(b.date) });
  }
  return NextResponse.json({ id: order.id, number: order.number }, { status: 201 });
}
