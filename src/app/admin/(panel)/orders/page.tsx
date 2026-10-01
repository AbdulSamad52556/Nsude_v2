import Link from "next/link";
import { db } from "@/lib/server/db";
import { formatPrice, cx } from "@/lib/utils";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { ReleaseExpiredOrders } from "@/components/admin/ReleaseExpiredOrders";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Search = { status?: string; q?: string; page?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/orders${s ? `?${s}` : ""}`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Search }) {
  const status = ORDER_STATUSES.includes(searchParams.status as OrderStatus)
    ? (searchParams.status as OrderStatus)
    : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

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

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const allCount = counts.reduce((n, c) => n + c._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
              href={href({ status: t.value, q })}
              className={cx(
                "border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
                status === t.value ? "border-ink bg-ink text-paper" : "border-graphite/20 text-graphite hover:border-ink"
              )}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/orders" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Order no., email or phone"
            className="h-10 w-64 border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
          />
          <button type="submit" className="h-10 bg-ink px-4 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite">
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="border border-graphite/15 p-8 text-center text-sm text-graphite">
          {q || status ? "No orders match." : "No orders yet."}
        </p>
      ) : (
        <div className="overflow-x-auto border border-graphite/15">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-graphite/15 text-[11px] uppercase tracking-widest2 text-ash">
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
            <tbody className="divide-y divide-graphite/10">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-bone/60">
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

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-widest2">
          {page > 1 ? (
            <Link href={href({ status, q, page: String(page - 1) })} className="text-graphite hover:text-ink">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ash">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ status, q, page: String(page + 1) })} className="text-graphite hover:text-ink">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
