import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { db } from "@/lib/server/db";
import { superadminEmail } from "@/lib/server/auth";
import { cx } from "@/lib/utils";
import { isActive } from "@/lib/activity";
import { RANGES, formatDuration, rangeStart, type RangeKey } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { auditTime } from "@/components/admin/AuditList";

const DEVICE_ICON = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as const;

/** Switch between shoppers' visits and admin users' visits. */
export function ActivityTabs({ area }: { area: "store" | "admin" }) {
  const tab = (active: boolean) =>
    cx(
      "rounded px-4 py-2 text-[11px] uppercase tracking-widest2 transition-colors",
      active ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30"
    );
  return (
    <nav aria-label="Whose activity" className="mb-6 inline-flex rounded-md border border-taupe/50 p-0.5">
      <Link href="/admin/activity" className={tab(area === "store")}>
        Customers & visitors
      </Link>
      <Link href="/admin/activity?area=admin" className={tab(area === "admin")}>
        Admin users
      </Link>
    </nav>
  );
}

type Search = { range?: string; user?: string; device?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(
    Object.entries({ area: "admin", ...params }).filter(([, v]) => v) as [string, string][]
  );
  return `/admin/activity?${q}`;
}

/**
 * Admin users in the admin panel: each sign-in is a visit, with the pages
 * they opened, what they clicked and the changes they saved (from Audit).
 * Includes the super admin.
 */
export async function AdminVisits({
  searchParams,
  showTabs,
}: {
  searchParams: Search;
  /** Also allowed to see customer activity. */
  showTabs: boolean;
}) {
  const range: RangeKey = RANGES.some((r) => r.key === searchParams.range) ? (searchParams.range as RangeKey) : "7d";
  const since = rangeStart(range);
  const device = (["mobile", "desktop", "tablet"] as const).find((d) => d === searchParams.device);
  const superEmail = superadminEmail();

  const users = await db.adminUser.findMany({ orderBy: { name: "asc" }, select: { email: true, name: true } });
  const people = [{ email: superEmail, name: "Super admin" }, ...users];
  const nameOf = new Map(people.map((p) => [p.email, p.name]));
  const user = people.find((p) => p.email === searchParams.user)?.email;

  const where: Prisma.VisitSessionWhereInput = {
    area: "admin",
    startedAt: { gte: since },
    ...(device ? { device } : {}),
    ...(user ? { adminEmail: user } : {}),
  };
  const auditWhere: Prisma.AuditLogWhereInput = {
    actorType: "admin",
    at: { gte: since },
    ...(user ? { actorLabel: user } : {}),
  };

  const total = await db.visitSession.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const [visits, activeUsers, changes, failed] = await Promise.all([
    db.visitSession.findMany({ where, orderBy: { startedAt: "desc" }, skip, take: size }),
    db.visitSession.groupBy({ by: ["adminEmail"], where }),
    db.auditLog.count({ where: auditWhere }),
    db.activityEvent.count({
      where: {
        area: "admin",
        type: "sign_in_failed",
        at: { gte: since },
        ...(user ? { sessionKey: { in: (await db.visitSession.findMany({ where, select: { key: true } })).map((v) => v.key) } } : {}),
      },
    }),
  ]);

  // Per visit: changes saved during it, and how it ended.
  const [savedCounts, endings] = await Promise.all([
    Promise.all(
      visits.map((v) =>
        v.adminEmail
          ? db.auditLog.count({
              where: { actorType: "admin", actorLabel: v.adminEmail, at: { gte: v.startedAt, lte: new Date(v.lastSeenAt.getTime() + 5000) } },
            })
          : 0
      )
    ),
    db.activityEvent.findMany({
      where: { sessionKey: { in: visits.map((v) => v.key) }, type: { in: ["signed_out", "sign_in_failed", "signed_in"] } },
      select: { sessionKey: true, type: true },
    }),
  ]);
  const ended = (key: string, type: string) => endings.some((e) => e.sessionKey === key && e.type === type);

  const avgMs = visits.length ? visits.reduce((n, v) => n + (v.lastSeenAt.getTime() - v.startedAt.getTime()), 0) / visits.length : 0;
  const chip = (active: boolean) =>
    cx(
      "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-ink bg-ink text-paper" : "border-taupe/50 text-graphite hover:border-ink"
    );
  const base = { range: range === "7d" ? undefined : range, user, device, size: searchParams.size };
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  return (
    <div>
      <AdminPageHeader title="Activity" subtitle="What admin users did in the admin panel, sign-in to sign-out." />
      {showTabs && <ActivityTabs area="admin" />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Sessions", value: total },
          { label: "Active users", value: activeUsers.length },
          { label: "Changes saved", value: changes },
          { label: "Failed sign-ins", value: failed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-4">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className={cx("mt-2 text-2xl font-medium", s.label === "Failed sign-ins" && s.value > 0 && "text-rust")}>{s.value}</p>
            <p className="mt-0.5 text-[10px] text-ash">{rangeLabel}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <nav aria-label="Period" className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link key={r.key} href={href({ ...base, range: r.key === "7d" ? undefined : r.key })} className={chip(range === r.key)}>
              {r.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="User" className="flex flex-wrap gap-2">
          <Link href={href({ ...base, user: undefined })} className={chip(!user)}>
            All users
          </Link>
          {people.map((p) => (
            <Link key={p.email} href={href({ ...base, user: p.email })} className={chip(user === p.email)}>
              {p.name}
            </Link>
          ))}
        </nav>
      </div>

      {visits.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">No admin sessions in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Started</th>
                <th className="p-3 font-normal">User</th>
                <th className="p-3 font-normal">Device</th>
                <th className="p-3 font-normal">Pages</th>
                <th className="p-3 font-normal">Time</th>
                <th className="p-3 font-normal">Changes saved</th>
                <th className="p-3 font-normal">Ended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {visits.map((v, i) => {
                const Icon = DEVICE_ICON[v.device as keyof typeof DEVICE_ICON] ?? Monitor;
                const live = isActive(v.lastSeenAt);
                const failedOnly = ended(v.key, "sign_in_failed") && !ended(v.key, "signed_in");
                const status = failedOnly
                  ? { label: "Failed sign-in", tone: "border-rust/40 text-rust" }
                  : ended(v.key, "signed_out")
                    ? { label: "Signed out", tone: "border-taupe/50 text-ash" }
                    : live
                      ? { label: "Active now", tone: "border-ink bg-ink text-paper" }
                      : { label: "Left (idle)", tone: "border-sand bg-sand/40 text-ink" };
                return (
                  <tr key={v.id} className="hover:bg-sand/15">
                    <td className="whitespace-nowrap p-3">
                      <Link href={`/admin/activity/${v.id}`} className="underline-offset-4 hover:underline">
                        {auditTime(v.startedAt)}
                      </Link>
                    </td>
                    <td className="p-3">
                      <p>{(v.adminEmail && nameOf.get(v.adminEmail)) ?? "—"}</p>
                      <p className="text-xs text-ash">{v.adminEmail}</p>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5 text-graphite">
                        <Icon size={14} strokeWidth={1.5} /> {v.browser}
                      </span>
                      <span className="text-xs text-ash">{v.os}</span>
                    </td>
                    <td className="p-3 text-graphite">{v.pageViews}</td>
                    <td className="whitespace-nowrap p-3 text-graphite">{formatDuration(v.lastSeenAt.getTime() - v.startedAt.getTime())}</td>
                    <td className="p-3">{savedCounts[i] || <span className="text-ash">0</span>}</td>
                    <td className="p-3">
                      <span className={cx("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", status.tone)}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visits.length > 0 && <p className="mt-2 text-[11px] text-ash">Average session on this page: {formatDuration(avgMs)}</p>}

      <Pagination page={page} pages={pages} size={size} total={total} noun={total === 1 ? "session" : "sessions"} href={(p) => href({ ...base, ...p })} />
    </div>
  );
}
