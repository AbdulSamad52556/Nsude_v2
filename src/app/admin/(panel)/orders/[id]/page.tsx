import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { NEXT_STATUSES } from "@/lib/server/orders";
import { isObjectId } from "@/lib/server/revalidate";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import { AuditList } from "@/components/admin/AuditList";
import { OrderMoneyButton } from "@/components/admin/FinanceActions";
import { formatPaise } from "@/lib/finance";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const dateTime = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AdminOrderPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("orders.view");
  if (!isObjectId(params.id)) notFound();
  const order = await db.order.findUnique({ where: { id: params.id } });
  // Custom prints on this order: their designs (previews + print files).
  const designIds = order ? order.items.flatMap((i) => (i.designId ? [i.designId] : [])) : [];
  const designs = new Map(
    (designIds.length ? await db.customDesign.findMany({ where: { id: { in: designIds } } }) : []).map((d) => [d.id, d])
  );
  /** Cloudinary link that downloads (as `name`) instead of opening. */
  const download = (url: string, name: string) =>
    url.replace("/upload/", `/upload/fl_attachment:${name.replace(/[^A-Za-z0-9_-]/g, "-")}/`);
  if (!order) notFound();

  const a = order.address;
  const history = await db.auditLog.findMany({ where: { entity: "order", entityId: order.id }, orderBy: { at: "desc" } });
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div>
      <Link href="/admin/orders" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All orders
      </Link>
      <AdminPageHeader
        title={order.number}
        subtitle={`${order.createdBy ? `Entered by ${order.createdBy}` : "Placed"} ${dateTime(order.createdAt)} · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
        action={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-taupe/30">
          <h2 className="border-b border-taupe/30 p-4 text-xs uppercase tracking-widest2">Items</h2>
          <ul className="divide-y divide-taupe/20">
            {order.items.map((item) => {
              const design = item.designId ? designs.get(item.designId) : undefined;
              return (
              <li key={`${item.code}-${item.size}-${item.designId ?? ""}`} className="p-4">
               <div className="flex items-center gap-4">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-sand/25">
                  {item.image && <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm uppercase tracking-wide">{item.name}</p>
                  <p className="text-xs text-ash">
                    {item.color} · {item.size} ·{" "}
                    {item.designId ? (
                      <span className="font-mono">{item.code}</span>
                    ) : (
                      <Link href={`/product/${item.code}`} target="_blank" className="font-mono underline-offset-2 hover:underline">
                        {item.code}
                      </Link>
                    )}
                  </p>
                  {item.design && (
                    <span className="mt-1.5 inline-block rounded bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                      Custom · {item.design}
                    </span>
                  )}
                </div>
                <p className="text-sm text-graphite">
                  {item.quantity} × {formatPrice(item.price)}
                </p>
                <p className="w-24 text-right text-sm">{formatPrice(item.price * item.quantity)}</p>
               </div>
                {/* What to print: per side, the preview, the print-ready PNG and the customer's originals. */}
                {item.designId && (
                  <div className="mt-4 rounded-md border border-taupe/30 bg-sand/10 p-3">
                    {design ? (
                      <>
                        <div className="flex flex-wrap gap-4">
                          {design.sides.map((s) => (
                            <div key={s.side} className="flex items-start gap-3">
                              <a href={s.preview} target="_blank" rel="noreferrer" className="relative block h-28 w-[90px] shrink-0 overflow-hidden rounded bg-sand/25">
                                <Image src={s.preview} alt={`${s.side} preview`} fill sizes="90px" className="object-cover" />
                              </a>
                              <div className="flex flex-col gap-1.5 text-xs">
                                <p className="uppercase tracking-widest2 text-ash">{s.side}</p>
                                <a href={download(s.print, `${order.number}-${item.size}-${s.side}-print`)} className="inline-flex items-center gap-1 text-ink underline-offset-2 hover:underline">
                                  <Download size={13} /> Print file (PNG)
                                </a>
                                <a href={s.preview} target="_blank" rel="noreferrer" className="text-graphite underline-offset-2 hover:underline">
                                  View preview
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                        {design.assetIds.length > 0 && (
                          <p className="mt-3 text-xs text-graphite">
                            Customer&rsquo;s original images:{" "}
                            {design.assetIds.map((id, n) => (
                              <a
                                key={id}
                                href={`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/fl_attachment:${order.number}-artwork-${n + 1}/${id}`}
                                className="mr-2 underline underline-offset-2 hover:text-ink"
                              >
                                Image {n + 1}
                              </a>
                            ))}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-rust">The design for this item couldn&rsquo;t be found.</p>
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
          <dl className="flex flex-col gap-2 border-t border-taupe/30 p-4 text-sm">
            <div className="flex justify-between text-graphite">
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-graphite">
              <dt>Shipping</dt>
              <dd>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd>
            </div>
            {order.discount ? (
              <div className="flex justify-between text-graphite">
                <dt>Discount</dt>
                <dd>−{formatPrice(order.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-taupe/20 pt-2 text-base">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-taupe/30 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Status</h2>
            {can(admin, "orders.manage") ? (
              <OrderStatusControl
                id={order.id}
                status={order.status as OrderStatus}
                next={NEXT_STATUSES[order.status as OrderStatus] ?? []}
              />
            ) : (
              <p className="text-sm text-graphite">
                <OrderStatusBadge status={order.status} />
                <span className="mt-2 block text-xs text-ash">You can view this order but not change its status.</span>
              </p>
            )}
          </section>

          <section className="rounded-lg border border-taupe/30 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Payment</h2>
            <p>{PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
            <p className="text-graphite">{PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</p>
            {order.razorpayPaymentId && (
              <p className="mt-2 break-all font-mono text-xs text-ash">Payment {order.razorpayPaymentId}</p>
            )}
            {order.razorpayOrderId && (
              <p className="break-all font-mono text-xs text-ash">Razorpay order {order.razorpayOrderId}</p>
            )}
            {/* Money in / back out, entered in Finance. */}
            {order.moneyInAt && (
              <p className="mt-2 text-xs text-ink">
                {formatPaise(order.total * 100)} in Finance
                {can(admin, "finance.view") && (
                  <>
                    {" · "}
                    <Link href={`/admin/finance/ledger?q=${order.number}`} className="underline underline-offset-2">
                      view
                    </Link>
                  </>
                )}
              </p>
            )}
            {order.refundedAt && <p className="mt-1 text-xs text-rust">Refund of {formatPaise(order.total * 100)} paid</p>}
            {(can(admin, "orders.manage") || can(admin, "finance.manage")) && (
              <div className="mt-3">
                {order.paymentMethod === "cod" &&
                  !order.moneyInAt &&
                  order.paymentStatus !== "paid" &&
                  ["placed", "shipped", "delivered"].includes(order.status) && (
                    <OrderMoneyButton orderId={order.id} orderNumber={order.number} amountPaise={order.total * 100} action="cash_received" />
                  )}
                {order.paymentMethod === "offline" &&
                  !order.moneyInAt &&
                  order.paymentStatus !== "paid" &&
                  ["placed", "shipped", "delivered"].includes(order.status) && (
                    <OrderMoneyButton orderId={order.id} orderNumber={order.number} amountPaise={order.total * 100} action="paid" />
                  )}
                {order.paymentStatus === "refund_due" && !order.refundedAt && (
                  <OrderMoneyButton orderId={order.id} orderNumber={order.number} amountPaise={order.total * 100} action="refunded" />
                )}
              </div>
            )}
          </section>

          {order.note && (
            <section className="rounded-lg bg-sand/30 p-4 text-sm">
              <h2 className="mb-2 text-xs uppercase tracking-widest2">Internal note</h2>
              <p className="whitespace-pre-line text-graphite">{order.note}</p>
            </section>
          )}

          <section className="rounded-lg border border-taupe/30 p-4 text-sm">
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

          <section className="rounded-lg border border-taupe/30 p-4 text-sm">
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
      {can(admin, "audit.view") && (
        <section className="mt-12">
          <h2 className="mb-1 text-xs uppercase tracking-widest2">Audit</h2>
          <p className="mb-4 text-xs text-ash">Items, prices and address above are as ordered — later product or address edits don&apos;t change them.</p>
          <AuditList entries={history} showEntity={false} empty="No history recorded for this order." />
        </section>
      )}
    </div>
  );
}
