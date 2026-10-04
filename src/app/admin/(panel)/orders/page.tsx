import Link from "next/link";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { formatPrice, cx } from "@/lib/utils";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { ReleaseExpiredOrders } from "@/components/admin/ReleaseExpiredOrders";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

type Search = { status?: string; q?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/orders${s ? `?${s}` : ""}`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Search }) {
  await pageAdmin("orders.view");
  const status = ORDER_STATUSES.includes(searchParams.status as OrderStatus)
    ? (searchParams.status as OrderStatus)
    : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 60);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { number: { equals: q.toUpperCase() } },
            { email: { equals: q.toLowerCase() } },
            { phone: { equals: q.replace(/\D/g, "").slice(-10) } },
          ],
        }
      : {}),
  };

  const [total, counts] = await Promise.all([
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const orders = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: size });
  // Keep the chosen rows-per-page when switching filters.
  const sizeParam = searchParams.size;
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const allCount = counts.reduce((n, c) => n + c._count._all, 0);

  const tabs = [
    { label: "All", value: undefined, count: allCount },
    ...ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s, count: countFor(s) })),
  ];

  return (
    <div>
      <ReleaseExpiredOrders />
      <AdminPageHeader
        title="Orders"
        subtitle={`${countFor("placed")} to ship · ${allCount} order${allCount === 1 ? "" : "s"} in total.`}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={href({ status: t.value, q, size: sizeParam })}
              className={cx(
                "border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
                status === t.value ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
              )}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/orders" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {sizeParam && <input type="hidden" name="size" value={sizeParam} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Order no., email or phone"
            className="rounded-md h-10 w-64 border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none"
          />
          <button type="submit" className="rounded-md h-10 bg-moss px-4 text-xs uppercase tracking-widest2 text-paper hover:brightness-90">
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">
          {q || status ? "No orders match." : "No orders yet."}
        </p>
      ) : (
        <div className="rounded-lg overflow-x-auto border border-taupe/30">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Order</th>
                <th className="p-3 font-normal">Date</th>
                <th className="p-3 font-normal">Customer</th>
                <th className="p-3 font-normal">Items</th>
                <th className="p-3 font-normal">Total</th>
                <th className="p-3 font-normal">Payment</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-sand/15">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap p-3 text-graphite">
                    {o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </td>
                  <td className="p-3">
                    <p>
                      {o.address.firstName} {o.address.lastName}
                    </p>
                    <p className="text-xs text-ash">
                      {o.address.city}, {o.address.state}
                    </p>
                  </td>
                  <td className="p-3 text-graphite">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="p-3">{formatPrice(o.total)}</td>
                  <td className="p-3">
                    <p className="text-xs uppercase tracking-wide">{o.paymentMethod === "cod" ? "COD" : "Online"}</p>
                    <p className={cx("text-xs", o.paymentStatus === "paid" ? "text-ink" : "text-ash")}>
                      {PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}
                    </p>
                  </td>
                  <td className="p-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        size={size}
        total={total}
        noun={total === 1 ? "order" : "orders"}
        href={(p) => href({ status, q, ...p })}
      />
    </div>
  );
}
