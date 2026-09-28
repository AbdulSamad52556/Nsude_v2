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
import { fieldErrors } from "@/lib/validation";
import { checkoutSchema } from "@/lib/checkout";

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
      },
    })
  ).catch(async (err) => {
    await giveBackStock(quote.lines);
    throw err;
  });
  await refreshCatalog(quote.lines.map((l) => l.productId));

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
