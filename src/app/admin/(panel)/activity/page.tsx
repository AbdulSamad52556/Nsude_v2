import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { cx } from "@/lib/utils";
import { OUTCOME_LABEL, OUTCOME_TONE, visitOutcome, type VisitOutcome } from "@/lib/activity";
import { RANGES, describeSource, formatDuration, rangeStart, type RangeKey } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Activity" };

type Search = { range?: string; who?: string; outcome?: string; device?: string; visitor?: string; q?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/activity${s ? `?${s}` : ""}`;
}

const WHO = [
  { key: "", label: "Everyone" },
  { key: "customers", label: "Signed-in customers" },
  { key: "guests", label: "Guests" },
] as const;
const OUTCOMES: { key: "" | VisitOutcome; label: string }[] = [
  { key: "", label: "Any outcome" },
  { key: "ordered", label: OUTCOME_LABEL.ordered },
  { key: "checkout", label: OUTCOME_LABEL.checkout },
  { key: "bag", label: OUTCOME_LABEL.bag },
  { key: "browsed", label: OUTCOME_LABEL.browsed },
];
const DEVICES = ["mobile", "desktop", "tablet"] as const;
const DEVICE_ICON = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as const;

/** Every storefront visit: who, from where, what they did, how it ended. */
export default async function ActivityPage({ searchParams }: { searchParams: Search }) {
  await pageAdmin("activity.view");
  const range: RangeKey = RANGES.some((r) => r.key === searchParams.range) ? (searchParams.range as RangeKey) : "7d";
  const who = WHO.some((w) => w.key && w.key === searchParams.who) ? searchParams.who : undefined;
  const outcome = OUTCOMES.some((o) => o.key && o.key === searchParams.outcome) ? (searchParams.outcome as VisitOutcome) : undefined;
  const device = DEVICES.find((d) => d === searchParams.device);
  const visitor = searchParams.visitor && /^[A-Za-z0-9_-]{16,64}$/.test(searchParams.visitor) ? searchParams.visitor : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const since = rangeStart(range);

  // Search: an order number, or a customer's phone / name.
  let searchIds: string[] | null = null;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const digits = q.replace(/\D/g, "").slice(-10);
    const customers = await db.customer.findMany({
      where: { OR: [...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []), { name: { contains: safe, mode: "insensitive" } }] },
      select: { id: true },
      take: 50,
    });
    searchIds = customers.map((c) => c.id);
  }

  const where: Prisma.VisitSessionWhereInput = {
    startedAt: { gte: since },
    ...(who === "customers" ? { customerId: { not: null } } : who === "guests" ? { customerId: null } : {}),
    ...(device ? { device } : {}),
    ...(visitor ? { visitorId: visitor } : {}),
    ...(outcome === "ordered"
      ? { orderNumbers: { isEmpty: false } }
      : outcome === "checkout"
        ? { orderNumbers: { isEmpty: true }, reachedCheckout: true }
        : outcome === "bag"
          ? { orderNumbers: { isEmpty: true }, reachedCheckout: false, addedToBag: true }
          : outcome === "browsed"
            ? { orderNumbers: { isEmpty: true }, reachedCheckout: false, addedToBag: false }
            : {}),
    ...(searchIds ? { OR: [{ customerId: { in: searchIds } }, { orderNumbers: { has: q.toUpperCase() } }] } : {}),
  };

  const total = await db.visitSession.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const [visits, statsRaw] = await Promise.all([
    db.visitSession.findMany({ where, orderBy: { startedAt: "desc" }, skip, take: size }),
    // Headline numbers for the whole period (ignoring the other filters).
    db.visitSession.aggregateRaw({
      pipeline: [
        { $match: { startedAt: { $gte: { $date: since.toISOString() } } } },
        {
          $group: {
            _id: null,
            visits: { $sum: 1 },
            visitors: { $addToSet: "$visitorId" },
            avgMs: { $avg: { $subtract: ["$lastSeenAt", "$startedAt"] } },
            pages: { $avg: "$pageViews" },
            bag: { $sum: { $cond: ["$addedToBag", 1, 0] } },
            ordered: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$orderNumbers", []] } }, 0] }, 1, 0] } },
          },
        },
        { $project: { visits: 1, visitors: { $size: "$visitors" }, avgMs: 1, pages: 1, bag: 1, ordered: 1 } },
      ],
    }),
  ]);
  const stats = ((statsRaw as unknown as Record<string, number>[])[0] ?? {}) as Record<string, number>;
  const pct = (n = 0) => (stats.visits ? `${Math.round((n / stats.visits) * 100)}%` : "—");

  const customerIds = Array.from(new Set(visits.map((v) => v.customerId).filter((id): id is string => Boolean(id))));
  const customers = new Map(
    (await db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, phone: true } })).map((c) => [c.id, c])
  );

  const base = { range, who, outcome, device, visitor, q, size: searchParams.size };
  const chip = (active: boolean) =>
    cx(
      "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
    );
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  return (
    <div>
      <AdminPageHeader title="Activity" subtitle="Every visit to the store, from the first page to the last." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Visits", value: stats.visits ?? 0 },
          { label: "Visitors", value: stats.visitors ?? 0 },
          { label: "Avg. visit", value: stats.avgMs ? formatDuration(stats.avgMs) : "—" },
          { label: "Pages / visit", value: stats.pages ? stats.pages.toFixed(1) : "—" },
          { label: "Added to bag", value: pct(stats.bag) },
          { label: "Ordered", value: pct(stats.ordered) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-4">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className="mt-2 text-2xl font-medium">{s.value}</p>
            <p className="mt-0.5 text-[10px] text-ash">{rangeLabel}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Period" className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link key={r.key} href={href({ ...base, range: r.key === "7d" ? undefined : r.key })} className={chip(range === r.key)}>
                {r.label}
              </Link>
            ))}
          </nav>
          <form action="/admin/activity" className="flex gap-2">
            {Object.entries(base).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <input
              name="q"
              defaultValue={q}
              placeholder="Order no., phone or name"
              className="h-10 w-60 rounded-md border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none"
            />
            <button type="submit" className="h-10 rounded-md bg-moss px-4 text-xs uppercase tracking-widest2 text-paper hover:brightness-90">
              Search
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {WHO.map((w) => (
            <Link key={w.label} href={href({ ...base, who: w.key || undefined })} className={chip((who ?? "") === w.key)}>
              {w.label}
            </Link>
          ))}
          <span className="mx-1 hidden w-px bg-taupe/30 sm:block" />
          {OUTCOMES.map((o) => (
            <Link key={o.label} href={href({ ...base, outcome: o.key || undefined })} className={chip((outcome ?? "") === o.key)}>
              {o.label}
            </Link>
          ))}
          <span className="mx-1 hidden w-px bg-taupe/30 sm:block" />
          {DEVICES.map((d) => (
            <Link key={d} href={href({ ...base, device: device === d ? undefined : d })} className={chip(device === d)}>
              {d}
            </Link>
          ))}
        </div>
        {visitor && (
          <p className="text-xs text-graphite">
            Showing visits from one browser.{" "}
            <Link href={href({ ...base, visitor: undefined })} className="underline underline-offset-4 hover:text-moss">
              Show everyone
            </Link>
          </p>
        )}
      </div>

      {visits.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">No visits match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Started</th>
                <th className="p-3 font-normal">Visitor</th>
                <th className="p-3 font-normal">Device</th>
                <th className="p-3 font-normal">Source</th>
                <th className="p-3 font-normal">Entry → Exit</th>
                <th className="p-3 font-normal">Pages</th>
                <th className="p-3 font-normal">Time</th>
                <th className="p-3 font-normal">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {visits.map((v) => {
                const c = v.customerId ? customers.get(v.customerId) : null;
                const o = visitOutcome(v);
                const Icon = DEVICE_ICON[v.device as keyof typeof DEVICE_ICON] ?? Monitor;
                return (
                  <tr key={v.id} className="hover:bg-sand/15">
                    <td className="whitespace-nowrap p-3">
                      <Link href={`/admin/activity/${v.id}`} className="underline-offset-4 hover:underline">
                        {auditTime(v.startedAt)}
                      </Link>
                    </td>
                    <td className="p-3">
                      {c ? (
                        <>
                          <p>{c.name || `+91 ${c.phone}`}</p>
                          {c.name && <p className="text-xs text-ash">+91 {c.phone}</p>}
                        </>
                      ) : (
                        <>
                          <p className="text-graphite">Guest</p>
                          <p className="font-mono text-[10px] text-ash">{v.visitorId.slice(0, 8)}</p>
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5 text-graphite">
                        <Icon size={14} strokeWidth={1.5} /> {v.browser}
                      </span>
                      <span className="text-xs text-ash">{v.os}</span>
                    </td>
                    <td className="max-w-[160px] truncate p-3 text-graphite">{describeSource(v)}</td>
                    <td className="max-w-[260px] p-3 text-xs">
                      <p className="truncate">{v.landingPath}</p>
                      <p className="truncate text-ash">→ {v.exitPath}</p>
                    </td>
                    <td className="p-3 text-graphite">{v.pageViews}</td>
                    <td className="whitespace-nowrap p-3 text-graphite">{formatDuration(v.lastSeenAt.getTime() - v.startedAt.getTime())}</td>
                    <td className="p-3">
                      <span className={cx("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", OUTCOME_TONE[o])}>
                        {OUTCOME_LABEL[o]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} size={size} total={total} noun={total === 1 ? "visit" : "visits"} href={(p) => href({ ...base, ...p })} />
    </div>
  );
}
