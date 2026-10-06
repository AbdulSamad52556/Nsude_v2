import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { FINANCE_TABS, FINANCE_TYPES, formatPaise, type FinanceType } from "@/lib/finance";
import { LIVE, codToCollectWhere, employeeBalances, financeEmployees, refundsDueWhere, sumPaise } from "@/lib/server/finance";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { FinanceEntryButton } from "@/components/admin/FinanceEntryButton";
import { OrderMoneyButton } from "@/components/admin/FinanceActions";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Finance" };

/** Start of this month, India time. */
function monthStart() {
  const IST = 5.5 * 3600e3;
  const now = new Date(Date.now() + IST);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - IST);
}

/** The company's money at a glance: balance, this month, what's still to come in or go out. */
export default async function FinancePage() {
  const admin = await pageAdmin("finance.view");
  const canManage = can(admin, "finance.manage");
  const canOrderMoney = canManage || can(admin, "orders.manage");
  const since = monthStart();

  const [balance, moneyIn, moneyOut, expenses, hasOpening, codOrders, codSum, refundOrders, refundSum, owed, recent, byCategory, employees] =
    await Promise.all([
      sumPaise(),
      sumPaise({ at: { gte: since }, amount: { gt: 0 }, type: { not: "opening" } }),
      sumPaise({ at: { gte: since }, amount: { lt: 0 }, type: { not: "opening" } }),
      sumPaise({ at: { gte: since }, type: "expense" }),
      db.financeEntry.count({ where: { AND: [LIVE, { type: "opening" }] } }),
      db.order.findMany({ where: codToCollectWhere, orderBy: { createdAt: "asc" }, take: 8 }),
      db.order.aggregate({ where: codToCollectWhere, _sum: { total: true }, _count: true }),
      db.order.findMany({ where: refundsDueWhere, orderBy: { updatedAt: "asc" }, take: 8 }),
      db.order.aggregate({ where: refundsDueWhere, _sum: { total: true }, _count: true }),
      employeeBalances(),
      db.financeEntry.findMany({ orderBy: [{ at: "desc" }, { createdAt: "desc" }], take: 8 }),
      db.financeEntry.groupBy({
        by: ["category"],
        where: { AND: [LIVE, { type: "expense", at: { gte: since } }] },
        _sum: { amount: true },
      }),
      financeEmployees(),
    ]);
  const employeesOwe = Array.from(owed.values()).reduce((n, e) => n + Math.max(0, e.owes), 0);
  const categories = byCategory
    .map((c) => ({ name: c.category ?? "Other", paise: -(c._sum.amount ?? 0) }))
    .sort((a, b) => b.paise - a.paise);
  const maxCat = Math.max(1, ...categories.map((c) => c.paise));
  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const people = employees.map((e) => ({ email: e.email, name: e.name }));

  return (
    <div>
      <AdminPageHeader
        title="Finance"
        subtitle="Everything that moves the company's money: orders, refunds, expenses and employees."
        action={canManage && hasOpening > 0 ? <FinanceEntryButton employees={people} /> : undefined}
      />
      <SectionTabs tabs={FINANCE_TABS} active="/admin/finance" />

      {hasOpening === 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sand bg-sand/30 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
              <Landmark size={17} strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-medium">Start with the money in the bank</p>
              <p className="text-sm text-graphite">
                Enter the company account&apos;s current balance once. Orders, expenses and employees&apos; money move it from there.
              </p>
            </div>
          </div>
          {canManage ? (
            <FinanceEntryButton employees={people} initialType="opening" label="Set opening balance" />
          ) : (
            <p className="text-xs text-ash">Someone with Finance: manage can set it.</p>
          )}
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-ink p-5 text-paper sm:col-span-2 xl:col-span-1">
          <p className="text-[10px] uppercase tracking-widest2 text-paper/60">Company balance</p>
          <p className={cx("mt-2 text-3xl font-medium", balance < 0 && "text-rust")}>{formatPaise(balance)}</p>
          <p className="mt-1 text-[11px] text-paper/60">After every counted entry</p>
        </div>
        {[
          { label: `Money in · ${monthName}`, value: formatPaise(moneyIn), tone: "text-ink" },
          { label: `Money out · ${monthName}`, value: formatPaise(moneyOut), tone: "text-rust" },
          { label: `Expenses · ${monthName}`, value: formatPaise(-expenses) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-5">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className={cx("mt-2 text-2xl font-medium", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: "To collect (COD & unpaid)", value: formatPaise((codSum._sum.total ?? 0) * 100), hint: `${codSum._count} order${codSum._count === 1 ? "" : "s"}` },
          { label: "Refunds due", value: formatPaise((refundSum._sum.total ?? 0) * 100), hint: `${refundSum._count} order${refundSum._count === 1 ? "" : "s"}` },
          { label: "Employees owe the company", value: formatPaise(employeesOwe), hint: "Money taken minus money added", href: "/admin/finance/employees" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-5">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className="mt-2 text-2xl font-medium">{s.value}</p>
            {s.href ? (
              <Link href={s.href} className="mt-1 inline-block text-[11px] text-ash underline-offset-4 hover:text-ink hover:underline">
                {s.hint}
              </Link>
            ) : (
              <p className="mt-1 text-[11px] text-ash">{s.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <OrderList
          title="Money to collect"
          empty="Nothing waiting to be paid."
          orders={codOrders}
          action={canOrderMoney ? "collect" : null}
          note="COD cash not yet received, and admin orders not paid yet."
        />
        <OrderList
          title="Refunds due"
          empty="No refunds waiting."
          orders={refundOrders}
          action={canOrderMoney ? "refunded" : null}
          note="Paid orders that were cancelled."
        />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest2">Recent entries</h2>
            <Link href="/admin/finance/ledger" className="flex items-center gap-1 text-[11px] uppercase tracking-widest2 text-ash hover:text-ink">
              Full ledger <ArrowRight size={13} strokeWidth={1.5} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No entries yet.</p>
          ) : (
            <ul className="divide-y divide-taupe/20 overflow-hidden rounded-lg border border-taupe/30">
              {recent.map((e) => (
                <li key={e.id} className={cx("flex items-center gap-3 p-3 text-sm", e.voidedAt && "opacity-50")}>
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate", e.voidedAt && "line-through")}>{e.description}</p>
                    <p className="text-xs text-ash">
                      {FINANCE_TYPES[e.type as FinanceType]?.label ?? e.type} · {auditTime(e.at)}
                    </p>
                  </div>
                  <span className={cx("shrink-0 font-medium", e.amount >= 0 ? "text-ink" : "text-rust", e.voidedAt && "line-through")}>
                    {formatPaise(e.amount, { sign: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest2">Expenses by category · {monthName}</h2>
          {categories.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No expenses this month.</p>
          ) : (
            <ul className="flex flex-col gap-3 rounded-lg border border-taupe/30 p-4">
              {categories.map((c) => (
                <li key={c.name} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span>{c.name}</span>
                    <span className="text-graphite">{formatPaise(c.paise)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sand/30">
                    <div className="h-full rounded-full bg-taupe" style={{ width: `${(c.paise / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function OrderList({
  title,
  empty,
  note,
  orders,
  action,
}: {
  title: string;
  empty: string;
  note: string;
  orders: {
    id: string;
    number: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: Date;
    address: { firstName: string; lastName: string };
  }[];
  /** "collect": cash received for COD, mark paid for admin orders. */
  action: "collect" | "refunded" | null;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest2">{title}</h2>
      <p className="mb-3 mt-0.5 text-[11px] text-ash">{note}</p>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">{empty}</p>
      ) : (
        <ul className="divide-y divide-taupe/20 overflow-hidden rounded-lg border border-taupe/30">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/orders/${o.id}`} className="font-mono underline-offset-4 hover:underline">
                  {o.number}
                </Link>
                <p className="text-xs text-ash">
                  {o.address.firstName} {o.address.lastName} · {o.paymentMethod === "offline" ? "admin order" : o.paymentMethod} · {o.status} ·{" "}
                  {auditTime(o.createdAt)}
                </p>
              </div>
              <span className="font-medium">{formatPaise(o.total * 100)}</span>
              {action && (
                <OrderMoneyButton
                  orderId={o.id}
                  orderNumber={o.number}
                  amountPaise={o.total * 100}
                  action={action === "collect" ? (o.paymentMethod === "offline" ? "paid" : "cash_received") : action}
                  compact
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
