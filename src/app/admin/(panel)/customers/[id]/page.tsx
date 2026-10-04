import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { isObjectId } from "@/lib/server/revalidate";
import { describeAddress } from "@/lib/server/audit";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { AuditList, auditTime } from "@/components/admin/AuditList";
import { OUTCOME_LABEL, OUTCOME_TONE, visitOutcome } from "@/lib/activity";
import { formatDuration } from "@/lib/server/activityView";
import { cx } from "@/lib/utils";

export const metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

/** One customer: current details, orders (with the address each was sent
    to) and the full history of their changes. Admin only. */
export default async function CustomerPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("customers.view");
  if (!isObjectId(params.id)) notFound();
  const customer = await db.customer.findUnique({ where: { id: params.id } });
  if (!customer) notFound();

  const [orders, history, sessions, visits] = await Promise.all([
    db.order.findMany({
      where: { OR: [{ customerId: customer.id }, { phone: customer.phone }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.auditLog.findMany({ where: { entity: "customer", entityId: customer.id }, orderBy: { at: "desc" }, take: 200 }),
    db.customerSession.findMany({ where: { customerId: customer.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } }),
    can(admin, "activity.view")
      ? db.visitSession.findMany({ where: { customerId: customer.id }, orderBy: { startedAt: "desc" }, take: 10 })
      : [],
  ]);

  return (
    <div>
      <Link href="/admin/customers" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All customers
      </Link>
      <AdminPageHeader
        title={customer.name || `+91 ${customer.phone}`}
        subtitle={`+91 ${customer.phone}${customer.email ? ` · ${customer.email}` : ""} · joined ${auditTime(customer.createdAt)}`}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Orders · {orders.length}</h2>
            {orders.length === 0 ? (
              <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No orders yet.</p>
            ) : (
              <ul className="rounded-lg divide-y divide-taupe/20 border border-taupe/30 overflow-hidden">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                    <span className="text-xs text-ash">{auditTime(o.createdAt)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="ml-auto">{formatPrice(o.total)}</span>
                    {/* The address as it was when ordered (never changes later). */}
                    <span className="w-full text-xs text-graphite">Shipped to: {describeAddress(o.address)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can(admin, "activity.view") && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-widest2">Recent visits</h2>
              {visits.length === 0 ? (
                <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No visits recorded yet.</p>
              ) : (
                <ul className="divide-y divide-taupe/20 overflow-hidden rounded-lg border border-taupe/30">
                  {visits.map((v) => {
                    const o = visitOutcome(v);
                    return (
                      <li key={v.id}>
                        <Link href={`/admin/activity/${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm hover:bg-sand/15">
                          <span>{auditTime(v.startedAt)}</span>
                          <span className="text-xs text-ash">
                            {v.pageViews} page{v.pageViews === 1 ? "" : "s"} · {formatDuration(v.lastSeenAt.getTime() - v.startedAt.getTime())} ·{" "}
                            {v.device}
                          </span>
                          <span className={cx("ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", OUTCOME_TONE[o])}>
                            {OUTCOME_LABEL[o]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {can(admin, "audit.view") && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-widest2">Audit</h2>
              <AuditList entries={history} showEntity={false} empty="This customer hasn't changed anything yet." />
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-taupe/30 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Saved addresses · {customer.addresses.length}</h2>
            {customer.addresses.length === 0 ? (
              <p className="text-graphite">None saved.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="leading-relaxed text-graphite">
                    {describeAddress(a)}
                    {customer.defaultAddressId === a.id && (
                      <span className="ml-2 rounded-full bg-moss/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-moss">Default</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-taupe/30 p-4 text-sm">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Signed in on · {sessions.length}</h2>
            {sessions.length === 0 ? (
              <p className="text-graphite">Not signed in anywhere.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-xs text-graphite">
                {sessions.map((s) => (
                  <li key={s.id}>
                    Last active {auditTime(s.lastUsedAt)}
                    <span className="block truncate text-ash">{s.userAgent || "Unknown device"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
