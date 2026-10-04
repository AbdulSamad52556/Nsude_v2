import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { cx } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { AuditList } from "@/components/admin/AuditList";

export const metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "product", label: "Products" },
  { key: "order", label: "Orders" },
  { key: "hero", label: "Hero" },
  { key: "admin_user", label: "Admin users" },
  { key: "finance", label: "Finance" },
] as const;
const ACTORS = [
  { key: "", label: "Anyone" },
  { key: "admin", label: "Admin" },
  { key: "customer", label: "Customers" },
  { key: "system", label: "System" },
] as const;

type Search = { entity?: string; by?: string; q?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/audit${s ? `?${s}` : ""}`;
}

/** Every change in the store, newest first, with filters. Admin only. */
export default async function AuditPage({ searchParams }: { searchParams: Search }) {
  await pageAdmin("audit.view");
  const entity = FILTERS.some((f) => f.key && f.key === searchParams.entity) ? searchParams.entity : undefined;
  const by = ACTORS.some((a) => a.key && a.key === searchParams.by) ? searchParams.by : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 60);

  const where: Prisma.AuditLogWhereInput = {
    ...(entity ? { entity } : {}),
    ...(by ? { actorType: by } : {}),
    ...(q
      ? {
          OR: [
            { entityLabel: { contains: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), mode: "insensitive" } },
            { actorLabel: { contains: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const total = await db.auditLog.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const entries = await db.auditLog.findMany({ where, orderBy: { at: "desc" }, skip, take: size });
  // Keep the chosen rows-per-page when switching filters.
  const sizeParam = searchParams.size;

  const chip = (active: boolean) =>
    cx(
      "border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
    );

  return (
    <div>
      <AdminPageHeader
        title="Audit"
        subtitle={`${total} change${total === 1 ? "" : "s"} recorded.`}
      />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="What changed" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link key={f.label} href={href({ entity: f.key || undefined, by, q, size: sizeParam })} className={chip((entity ?? "") === f.key)}>
                {f.label}
              </Link>
            ))}
          </nav>
          <form action="/admin/audit" className="flex gap-2">
            {entity && <input type="hidden" name="entity" value={entity} />}
            {by && <input type="hidden" name="by" value={by} />}
            {sizeParam && <input type="hidden" name="size" value={sizeParam} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Product, order no., phone, admin…"
              className="rounded-md h-10 w-64 border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none"
            />
            <button type="submit" className="rounded-md h-10 bg-moss px-4 text-xs uppercase tracking-widest2 text-paper hover:brightness-90">
              Search
            </button>
          </form>
        </div>
        <nav aria-label="Changed by" className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest2 text-ash">By</span>
          {ACTORS.map((a) => (
            <Link key={a.label} href={href({ entity, by: a.key || undefined, q, size: sizeParam })} className={chip((by ?? "") === a.key)}>
              {a.label}
            </Link>
          ))}
        </nav>
      </div>

      <AuditList entries={entries} empty={q || entity || by ? "No changes match." : "No changes recorded yet."} />

      <Pagination
        page={page}
        pages={pages}
        size={size}
        total={total}
        noun={total === 1 ? "change" : "changes"}
        href={(p) => href({ entity, by, q, ...p })}
      />
    </div>
  );
}
