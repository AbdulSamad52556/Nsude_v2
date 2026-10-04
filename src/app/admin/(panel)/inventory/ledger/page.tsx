import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { INVENTORY_TABS, STOCK_REASONS, type StockReason } from "@/lib/inventory";
import { RANGES, rangeStart, type RangeKey } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Stock ledger" };

type Search = { code?: string; reason?: string; range?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/inventory/ledger${s ? `?${s}` : ""}`;
}

const ACTOR_LABEL: Record<string, string> = { admin: "Admin", customer: "Customer", system: "System" };

/** Every stock movement, newest first: sales, cancellations, restocks… */
export default async function StockLedgerPage({ searchParams }: { searchParams: Search }) {
  const admin = await pageAdmin("inventory.view");
  const code = searchParams.code && /^[A-Za-z0-9]{2,20}$/.test(searchParams.code) ? searchParams.code.toUpperCase() : undefined;
  const reason = searchParams.reason && searchParams.reason in STOCK_REASONS ? (searchParams.reason as StockReason) : undefined;
  const range: RangeKey = RANGES.some((r) => r.key === searchParams.range) ? (searchParams.range as RangeKey) : "30d";

  const where: Prisma.StockMovementWhereInput = {
    at: { gte: rangeStart(range) },
    ...(code ? { code } : {}),
    ...(reason ? { reason } : {}),
  };
  const total = await db.stockMovement.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const [moves, totals] = await Promise.all([
    db.stockMovement.findMany({ where, orderBy: { at: "desc" }, skip, take: size }),
    db.stockMovement.aggregate({ where, _sum: { change: true } }),
  ]);
  const unitsIn = await db.stockMovement.aggregate({ where: { ...where, change: { gt: 0 } }, _sum: { change: true } });
  const net = totals._sum.change ?? 0;
  const added = unitsIn._sum.change ?? 0;
  const colourName = code ? (await db.stockMovement.findFirst({ where: { code }, orderBy: { at: "desc" } })) : null;

  const base = { code, reason, range: range === "30d" ? undefined : range, size: searchParams.size };
  const chip = (active: boolean) =>
    cx(
      "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
    );

  return (
    <div>
      <AdminPageHeader title="Inventory" subtitle="Every change to stock, with what was left after it." />
      <SectionTabs tabs={INVENTORY_TABS} active="/admin/inventory/ledger" />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Units in", value: `+${added}` },
          { label: "Units out", value: `−${added - net}` },
          { label: "Net change", value: `${net > 0 ? "+" : net < 0 ? "−" : ""}${Math.abs(net)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-4">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className="mt-2 text-2xl font-medium">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <nav aria-label="Period" className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link key={r.key} href={href({ ...base, range: r.key === "30d" ? undefined : r.key })} className={chip(range === r.key)}>
              {r.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Reason" className="flex flex-wrap gap-2">
          <Link href={href({ ...base, reason: undefined })} className={chip(!reason)}>
            All reasons
          </Link>
          {(Object.keys(STOCK_REASONS) as StockReason[]).map((r) => (
            <Link key={r} href={href({ ...base, reason: r })} className={chip(reason === r)}>
              {STOCK_REASONS[r]}
            </Link>
          ))}
        </nav>
        {code && (
          <p className="text-xs text-graphite">
            Showing {colourName ? `${colourName.productName} · ${colourName.color}` : code} ({code}) only.{" "}
            <Link href={href({ ...base, code: undefined })} className="underline underline-offset-4 hover:text-moss">
              Show all colours
            </Link>
          </p>
        )}
      </div>

      {moves.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">No stock movements in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">When</th>
                <th className="p-3 font-normal">Product · colour</th>
                <th className="p-3 font-normal">Change</th>
                <th className="p-3 font-normal">Stock after</th>
                <th className="p-3 font-normal">Reason</th>
                <th className="p-3 font-normal">Reference</th>
                <th className="p-3 font-normal">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {moves.map((m) => (
                <tr key={m.id} className="hover:bg-sand/15">
                  <td className="whitespace-nowrap p-3 text-graphite">{auditTime(m.at)}</td>
                  <td className="p-3">
                    <Link href={href({ ...base, code: m.code })} className="underline-offset-4 hover:underline">
                      {m.productName}
                    </Link>
                    <p className="text-xs text-ash">
                      {m.color} · <span className="font-mono">{m.code}</span>
                    </p>
                  </td>
                  <td className={cx("p-3 font-medium", m.change > 0 ? "text-moss" : "text-rust")}>
                    {m.change > 0 ? `+${m.change}` : `−${-m.change}`}
                  </td>
                  <td className="p-3">{m.stockAfter ?? "—"}</td>
                  <td className="p-3">
                    {STOCK_REASONS[m.reason as StockReason] ?? m.reason}
                    {m.note && <p className="text-xs text-ash">{m.note}</p>}
                  </td>
                  <td className="p-3 text-xs">
                    {m.ref?.startsWith("NS-") && can(admin, "orders.view") ? (
                      <Link href={`/admin/orders?q=${m.ref}`} className="font-mono text-moss underline underline-offset-2">
                        {m.ref}
                      </Link>
                    ) : (
                      (m.ref ?? <span className="text-ash">—</span>)
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="text-ash">{ACTOR_LABEL[m.actorType] ?? m.actorType} · </span>
                    {m.actorLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} size={size} total={total} noun="movements" href={(p) => href({ ...base, ...p })} />
    </div>
  );
}
