import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { FINANCE_TABS, FINANCE_TYPES, PAYMENT_METHODS_FINANCE, formatPaise, type FinanceType } from "@/lib/finance";
import { LIVE, financeEmployees, sumPaise } from "@/lib/server/finance";
import { RANGES, rangeStart, type RangeKey } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { FinanceEntryButton } from "@/components/admin/FinanceEntryButton";
import { VoidEntryButton } from "@/components/admin/FinanceActions";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Finance ledger" };

type Search = { type?: string; employee?: string; range?: string; q?: string; entry?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/finance/ledger${s ? `?${s}` : ""}`;
}

const METHOD = Object.fromEntries(PAYMENT_METHODS_FINANCE.map((m) => [m.key, m.label]));

/** Every money entry, newest first, with filters; voided ones crossed out. */
export default async function FinanceLedgerPage({ searchParams }: { searchParams: Search }) {
  const admin = await pageAdmin("finance.view");
  const canManage = can(admin, "finance.manage");
  const type = searchParams.type && searchParams.type in FINANCE_TYPES ? (searchParams.type as FinanceType) : undefined;
  const range: RangeKey = RANGES.some((r) => r.key === searchParams.range) ? (searchParams.range as RangeKey) : "all";
  const employees = await financeEmployees();
  const employee = employees.find((e) => e.email === searchParams.employee)?.email;
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const entryId = searchParams.entry && /^[a-f0-9]{24}$/.test(searchParams.entry) ? searchParams.entry : undefined;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const where: Prisma.FinanceEntryWhereInput = entryId
    ? { id: entryId }
    : {
        at: { gte: rangeStart(range) },
        ...(type ? { type } : {}),
        ...(employee ? { employeeEmail: employee } : {}),
        ...(q
          ? {
              OR: [
                { description: { contains: safe, mode: "insensitive" } },
                { orderNumber: { equals: q.toUpperCase() } },
                { reference: { contains: safe, mode: "insensitive" } },
                { category: { contains: safe, mode: "insensitive" } },
              ],
            }
          : {}),
      };

  const total = await db.financeEntry.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const [entries, moneyIn, moneyOut] = await Promise.all([
    db.financeEntry.findMany({ where, orderBy: [{ at: "desc" }, { createdAt: "desc" }], skip, take: size }),
    sumPaise({ AND: [where, { amount: { gt: 0 } }] }),
    sumPaise({ AND: [where, { amount: { lt: 0 } }] }),
  ]);
  const voided = await db.financeEntry.count({ where: { AND: [where, { NOT: LIVE }] } });

  const base = { type, employee, range: range === "all" ? undefined : range, q: q || undefined, size: searchParams.size };
  const chip = (active: boolean) =>
    cx(
      "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
    );

  return (
    <div>
      <AdminPageHeader
        title="Finance"
        subtitle="Every amount in and out of the company, newest first."
        action={canManage ? <FinanceEntryButton employees={employees} /> : undefined}
      />
      <SectionTabs tabs={FINANCE_TABS} active="/admin/finance/ledger" />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Money in", value: formatPaise(moneyIn), tone: "text-moss" },
          { label: "Money out", value: formatPaise(moneyOut), tone: "text-rust" },
          { label: "Net", value: formatPaise(moneyIn + moneyOut, { sign: true }) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-4">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className={cx("mt-2 text-xl font-medium", s.tone)}>{s.value}</p>
            <p className="mt-0.5 text-[10px] text-ash">Matching entries{voided ? ` · ${voided} voided not counted` : ""}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Period" className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link key={r.key} href={href({ ...base, range: r.key === "all" ? undefined : r.key })} className={chip(range === r.key)}>
                {r.label}
              </Link>
            ))}
          </nav>
          <form action="/admin/finance/ledger" className="flex gap-2">
            {type && <input type="hidden" name="type" value={type} />}
            {employee && <input type="hidden" name="employee" value={employee} />}
            {base.range && <input type="hidden" name="range" value={base.range} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Details, order no., reference"
              className="h-10 w-56 rounded-md border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none"
            />
            <button type="submit" className="h-10 rounded-md bg-moss px-4 text-xs uppercase tracking-widest2 text-paper hover:brightness-90">
              Search
            </button>
          </form>
        </div>
        <nav aria-label="Type" className="flex flex-wrap gap-2">
          <Link href={href({ ...base, type: undefined })} className={chip(!type)}>
            All types
          </Link>
          {(Object.keys(FINANCE_TYPES) as FinanceType[]).map((t) => (
            <Link key={t} href={href({ ...base, type: t })} className={chip(type === t)}>
              {FINANCE_TYPES[t].label}
            </Link>
          ))}
        </nav>
        {(employee || entryId) && (
          <p className="text-xs text-graphite">
            {entryId ? "Showing one entry." : `Showing ${employees.find((e) => e.email === employee)?.name}'s entries.`}{" "}
            <Link href={href({ ...base, employee: undefined })} className="underline underline-offset-4 hover:text-moss">
              Show all
            </Link>
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">No entries match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Date</th>
                <th className="p-3 font-normal">Type</th>
                <th className="p-3 font-normal">Details</th>
                <th className="p-3 font-normal">Method · ref</th>
                <th className="p-3 text-right font-normal">Amount</th>
                <th className="p-3 font-normal">Entered by</th>
                <th className="relative p-3 font-normal">
                  {/* relative: keeps the hidden label inside the table's scroll box */}
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {entries.map((e) => {
                const label = FINANCE_TYPES[e.type as FinanceType]?.label ?? e.type;
                return (
                  <tr key={e.id} className={cx("align-top hover:bg-sand/15", e.voidedAt && "bg-paper text-ash")}>
                    <td className="whitespace-nowrap p-3 text-graphite">{auditTime(e.at)}</td>
                    <td className="whitespace-nowrap p-3">{label}</td>
                    <td className="max-w-[320px] p-3">
                      <p className={cx(e.voidedAt && "line-through")}>{e.description}</p>
                      <p className="text-xs text-ash">
                        {[
                          e.category,
                          e.employeeName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {e.orderNumber && e.orderId && (
                          <Link href={`/admin/orders/${e.orderId}`} className="font-mono text-moss underline underline-offset-2">
                            {e.orderNumber}
                          </Link>
                        )}
                      </p>
                      {e.voidedAt && (
                        <p className="mt-1 text-xs text-rust">
                          Voided by {e.voidedBy} · {e.voidReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-graphite">
                      {e.method ? METHOD[e.method] ?? e.method : "—"}
                      {e.reference && <p className="break-all text-ash">{e.reference}</p>}
                    </td>
                    <td
                      className={cx(
                        "whitespace-nowrap p-3 text-right font-medium",
                        e.voidedAt ? "line-through" : e.amount >= 0 ? "text-moss" : "text-rust"
                      )}
                    >
                      {formatPaise(e.amount, { sign: true })}
                    </td>
                    <td className="p-3 text-xs text-graphite">{e.createdBy}</td>
                    <td className="p-3">
                      {canManage && !e.voidedAt && e.type !== "order_payment" && (
                        <VoidEntryButton id={e.id} label={`${label} ${formatPaise(e.amount, { sign: true })}`} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} size={size} total={total} noun="entries" href={(p) => href({ ...base, ...p })} />
    </div>
  );
}
