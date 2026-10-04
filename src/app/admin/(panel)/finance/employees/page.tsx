import Link from "next/link";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { FINANCE_TABS, formatPaise } from "@/lib/finance";
import { LIVE, employeeBalances, financeEmployees } from "@/lib/server/finance";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { FinanceEntryButton } from "@/components/admin/FinanceEntryButton";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Employee balances" };

/**
 * Each admin user's money with the company: what they took, what they added,
 * and what they owe (or are owed).
 */
export default async function FinanceEmployeesPage() {
  const admin = await pageAdmin("finance.view");
  const canManage = can(admin, "finance.manage");
  const [employees, balances, lastEntries] = await Promise.all([
    financeEmployees(),
    employeeBalances(),
    db.financeEntry.groupBy({
      by: ["employeeEmail"],
      where: { AND: [LIVE, { type: { in: ["employee_withdrawal", "employee_deposit"] } }] },
      _max: { at: true },
    }),
  ]);
  const last = new Map(lastEntries.map((l) => [l.employeeEmail, l._max.at]));
  const totals = Array.from(balances.values()).reduce(
    (t, b) => ({ owe: t.owe + Math.max(0, b.owes), owed: t.owed + Math.max(0, -b.owes) }),
    { owe: 0, owed: 0 }
  );
  const people = employees.map((e) => ({ email: e.email, name: e.name }));

  return (
    <div>
      <AdminPageHeader
        title="Finance"
        subtitle="Money each employee has taken from or added to the company."
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <FinanceEntryButton employees={people} initialType="employee_withdrawal" label="Employee takes" variant="outline" />
              <FinanceEntryButton employees={people} initialType="employee_deposit" label="Employee adds" />
            </div>
          ) : undefined
        }
      />
      <SectionTabs tabs={FINANCE_TABS} active="/admin/finance/employees" />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-taupe/30 p-4">
          <p className="text-[10px] uppercase tracking-widest2 text-ash">Employees owe the company</p>
          <p className="mt-2 text-2xl font-medium text-rust">{formatPaise(totals.owe)}</p>
        </div>
        <div className="rounded-lg border border-taupe/30 p-4">
          <p className="text-[10px] uppercase tracking-widest2 text-ash">Company owes employees</p>
          <p className="mt-2 text-2xl font-medium">{formatPaise(totals.owed)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-taupe/30">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
            <tr>
              <th className="p-3 font-normal">Employee</th>
              <th className="p-3 text-right font-normal">Taken</th>
              <th className="p-3 text-right font-normal">Added</th>
              <th className="p-3 text-right font-normal">Balance</th>
              <th className="p-3 font-normal">Last entry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {employees.map((e) => {
              const b = balances.get(e.email) ?? { taken: 0, added: 0, owes: 0 };
              const lastAt = last.get(e.email);
              return (
                <tr key={e.email} className="hover:bg-sand/15">
                  <td className="p-3">
                    <Link href={`/admin/finance/ledger?employee=${encodeURIComponent(e.email)}`} className="underline-offset-4 hover:underline">
                      {e.name}
                    </Link>
                    <p className="text-xs text-ash">
                      {e.email}
                      {!e.active && " · disabled"}
                    </p>
                  </td>
                  <td className="p-3 text-right text-graphite">{formatPaise(b.taken)}</td>
                  <td className="p-3 text-right text-graphite">{formatPaise(b.added)}</td>
                  <td className="p-3 text-right">
                    {b.owes === 0 ? (
                      <span className="text-ash">Settled</span>
                    ) : (
                      <span
                        className={cx(
                          "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
                          b.owes > 0 ? "border-rust/40 text-rust" : "border-moss bg-moss text-paper"
                        )}
                      >
                        {b.owes > 0 ? `Owes ${formatPaise(b.owes)}` : `Owed ${formatPaise(-b.owes)}`}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-graphite">{lastAt ? auditTime(lastAt) : <span className="text-ash">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ash">
        &ldquo;Owes&rdquo; = took more than they put back. &ldquo;Owed&rdquo; = added more than they took (e.g. paid a company bill
        themselves).
      </p>
    </div>
  );
}
