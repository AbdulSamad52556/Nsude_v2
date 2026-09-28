import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/server/db";
import { NEXT_STATUSES } from "@/lib/server/orders";
import { isObjectId } from "@/lib/server/revalidate";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const dateTime = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AdminOrderPage({ params }: { params: { id: string } }) {
  if (!isObjectId(params.id)) notFound();
  const order = await db.order.findUnique({ where: { id: params.id } });
  if (!order) notFound();

  const a = order.address;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div>
      <Link href="/admin/orders" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All orders
      </Link>
      <AdminPageHeader
        title={order.number}
        subtitle={`Placed ${dateTime(order.createdAt)} · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
        action={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="border border-graphite/15">
          <h2 className="border-b border-graphite/15 p-4 text-xs uppercase tracking-widest2">Items</h2>
          <ul className="divide-y divide-graphite/10">
            {order.items.map((item) => (
              <li key={`${item.code}-${item.size}`} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-bone">
                  {item.image && <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm uppercase tracking-wide">{item.name}</p>
                  <p className="text-xs text-ash">
                    {item.color} · {item.size} ·{" "}
                    <Link href={`/product/${item.code}`} target="_blank" className="font-mono underline-offset-2 hover:underline">
                      {item.code}
                    </Link>
                  </p>
                </div>
                <p className="text-sm text-graphite">
                  {item.quantity} × {formatPrice(item.price)}
                </p>
                <p className="w-24 text-right text-sm">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-2 border-t border-graphite/15 p-4 text-sm">
            <div className="flex justify-between text-graphite">
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-graphite">
              <dt>Shipping</dt>
              <dd>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-graphite/10 pt-2 text-base">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section className="border border-graphite/15 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Status</h2>
            <OrderStatusControl
              id={order.id}
              status={order.status as OrderStatus}
              next={NEXT_STATUSES[order.status as OrderStatus] ?? []}
            />
          </section>

          <section className="border border-graphite/15 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Payment</h2>
            <p>{order.paymentMethod === "cod" ? "Cash on delivery" : "Online (Razorpay)"}</p>
            <p className="text-graphite">{PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</p>
            {order.razorpayPaymentId && (
              <p className="mt-2 break-all font-mono text-xs text-ash">Payment {order.razorpayPaymentId}</p>
            )}
            {order.razorpayOrderId && (
              <p className="break-all font-mono text-xs text-ash">Razorpay order {order.razorpayOrderId}</p>
            )}
          </section>

          <section className="border border-graphite/15 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Customer</h2>
            <p>
              {a.firstName} {a.lastName}
            </p>
            <p>
              <a href={`mailto:${order.email}`} className="text-graphite underline-offset-2 hover:underline">
                {order.email}
              </a>
            </p>
            <p>
              <a href={`tel:+91${order.phone}`} className="text-graphite underline-offset-2 hover:underline">
                +91 {order.phone}
              </a>
            </p>
          </section>

          <section className="border border-graphite/15 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Ship to</h2>
            <address className="not-italic leading-relaxed text-graphite">
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              {a.country}
            </address>
          </section>

          <p className="text-xs text-ash">Last updated {dateTime(order.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
