import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  cancelOrder,
  giveBackStock,
  priceCart,
  refreshCatalog,
  releaseExpiredOrders,
  takeStock,
  withUniqueNumber,
} from "@/lib/server/orders";
import { createRazorpayOrder, razorpayEnabled, razorpayKeyId } from "@/lib/server/razorpay";
import { rateLimit } from "@/lib/server/rateLimit";
import { getCustomer, newAddressId } from "@/lib/server/customer";
import { MAX_SAVED_ADDRESSES } from "@/lib/account";
import { customerActor, describeAddress, recordAudit } from "@/lib/server/audit";
import { fieldErrors } from "@/lib/validation";
import { checkoutSchema } from "@/lib/checkout";
import { recordActivity } from "@/lib/server/activity";

// Places an order. Prices come from the catalog, stock is taken atomically,
// then either the order is placed (cash on delivery) or a Razorpay order is
// opened for the browser to pay (the order waits in "pending_payment").
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "checkout", 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const input = parsed.data;
  if (input.paymentMethod === "razorpay" && !razorpayEnabled()) {
    return NextResponse.json({ error: "Online payment isn't available right now" }, { status: 400 });
  }

  // Put stock from abandoned payments back on sale before checking stock.
  await releaseExpiredOrders().catch((err) => console.error("Releasing expired orders failed", err));

  const quote = await priceCart(input.items);
  if (quote.issues.length || quote.lines.length === 0) {
    return NextResponse.json(
      { error: "Some items in your bag changed. Please review your bag.", quote },
      { status: 409 }
    );
  }

  const taken = await takeStock(quote.lines);
  if (!taken.ok) {
    return NextResponse.json(
      { error: "Something in your bag just sold out. Please review your bag.", quote: await priceCart(input.items) },
      { status: 409 }
    );
  }

  // Signed-in customers get the order on their account (guests are fine too).
  const customer = await getCustomer();

  const cod = input.paymentMethod === "cod";
  // If the order can't be saved, the stock just taken goes straight back.
  const order = await withUniqueNumber((number) =>
    db.order.create({
      data: {
        number,
        status: cod ? "placed" : "pending_payment",
        paymentMethod: input.paymentMethod,
        paymentStatus: cod ? "cod" : "pending",
        items: quote.lines,
        subtotal: quote.subtotal,
        shipping: quote.shipping,
        total: quote.total,
        email: input.email,
        phone: input.phone,
        address: {
          firstName: input.firstName,
          lastName: input.lastName,
          line1: input.line1,
          line2: input.line2,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          country: "India",
        },
        stockHeld: true,
        customerId: customer?.id ?? null,
      },
    })
  ).catch(async (err) => {
    await giveBackStock(quote.lines);
    throw err;
  });
  await refreshCatalog(quote.lines.map((l) => l.productId));

  // History: the order as placed (its prices and address never change after).
  await recordAudit({
    actor: customer ? customerActor(customer.phone) : { type: "customer", label: `Guest · +91 ${input.phone}` },
    entity: "order",
    entityId: order.id,
    entityLabel: order.number,
    action: "Order placed",
    changes: [
      ...quote.lines.map((l) => ({
        field: `Item · ${l.name} (${l.color} · ${l.size})`,
        from: "—",
        to: `${l.quantity} × ₹${l.price.toLocaleString("en-IN")}`,
      })),
      { field: "Total", from: "—", to: `₹${order.total.toLocaleString("en-IN")}` },
      { field: "Ship to", from: "—", to: describeAddress(input) },
      { field: "Payment", from: "—", to: cod ? "Cash on delivery" : "Online (Razorpay)" },
    ],
  });

  await recordActivity(
    "order_placed",
    {
      order: order.number,
      total: order.total,
      items: quote.lines.reduce((n, l) => n + l.quantity, 0),
      payment: cod ? "cod" : "online",
    },
    { customerId: customer?.id }
  );

  // "Save this address" (signed in): add it unless it's already saved.
  if (customer && input.saveAddress && customer.addresses.length < MAX_SAVED_ADDRESSES) {
    const address = {
      firstName: input.firstName,
      lastName: input.lastName,
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
    };
    const key = (a: { line1: string; line2: string; city: string; pincode: string }) => JSON.stringify([a.line1, a.line2, a.city, a.pincode].map((v) => v.toLowerCase()));
    if (!customer.addresses.some((a) => key(a) === key(address))) {
      const id = newAddressId();
      await db.customer
        .update({
          where: { id: customer.id },
          data: {
            addresses: { push: { id, ...address } },
            ...(customer.addresses.length === 0 ? { defaultAddressId: id } : {}),
          },
        })
        .catch((err) => console.error("Saving address failed", err));
      await recordAudit({
        actor: customerActor(customer.phone),
        entity: "customer",
        entityId: customer.id,
        entityLabel: `+91 ${customer.phone}`,
        action: "Address added (at checkout)",
        changes: [{ field: "Address", from: "—", to: describeAddress(address) }],
      });
    }
  }

  if (cod) {
    return NextResponse.json({ number: order.number, status: order.status, total: order.total });
  }

  try {
    const rzp = await createRazorpayOrder(order.total, order.number);
    await db.order.update({ where: { id: order.id }, data: { razorpayOrderId: rzp.id } });
    return NextResponse.json({
      number: order.number,
      status: order.status,
      total: order.total,
      razorpay: { keyId: razorpayKeyId(), orderId: rzp.id, amount: rzp.amount, currency: rzp.currency },
    });
  } catch (err) {
    console.error("Creating Razorpay order failed", err);
    await cancelOrder(order, "failed");
    return NextResponse.json(
      { error: "Couldn't start the payment. Please try again, or choose cash on delivery." },
      { status: 502 }
    );
  }
}
