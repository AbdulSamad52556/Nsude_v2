import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  Clock,
  CreditCard,
  DoorOpen,
  Eye,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  MousePointerClick,
  PackageCheck,
  Pencil,
  Ruler,
  Search,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  User,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { isObjectId } from "@/lib/server/revalidate";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { ACTIVITY_LABEL, KEY_EVENTS, OUTCOME_LABEL, OUTCOME_TONE, VISIT_IDLE_MINUTES, visitOutcome } from "@/lib/activity";
import { describeEvent, describeSource, formatDuration, timeIST } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Visit" };

const ICON: Record<string, LucideIcon> = {
  page_view: Eye,
  page_leave: Clock,
  click: MousePointerClick,
  product_view: Shirt,
  size_select: Ruler,
  quantity_change: ShoppingBag,
  add_to_bag: ShoppingBag,
  buy_now: ShoppingBag,
  remove_from_bag: Trash2,
  bag_quantity: ShoppingBag,
  bag_open: ShoppingBag,
  search: Search,
  shop_filter: SlidersHorizontal,
  checkout_step: CreditCard,
  payment_method: CreditCard,
  order_placed: PackageCheck,
  payment_completed: CreditCard,
  payment_cancelled: XCircle,
  otp_requested: KeyRound,
  signed_up: UserPlus,
  signed_in: LogIn,
  signed_out: LogOut,
  profile_updated: User,
  address_saved: MapPin,
  address_deleted: MapPin,
  order_edited: Pencil,
  order_cancelled: XCircle,
};

const MAX_EVENTS = 2000;

/** One visit, step by step: every page, click and action, entry to exit. */
export default async function VisitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { steps?: string };
}) {
  const admin = await pageAdmin("activity.view");
  if (!isObjectId(params.id)) notFound();
  const visit = await db.visitSession.findUnique({ where: { id: params.id } });
  if (!visit) notFound();

  const keyOnly = searchParams.steps === "key";
  const [events, customer, otherVisits] = await Promise.all([
    db.activityEvent.findMany({
      where: { sessionKey: visit.key, ...(keyOnly ? { type: { notIn: ["click", "page_leave"] } } : {}) },
      orderBy: { at: "asc" },
      take: MAX_EVENTS,
    }),
    visit.customerId ? db.customer.findUnique({ where: { id: visit.customerId } }) : null,
    db.visitSession.count({ where: { visitorId: visit.visitorId, id: { not: visit.id } } }),
  ]);

  const durationMs = visit.lastSeenAt.getTime() - visit.startedAt.getTime();
  const live = Date.now() - visit.lastSeenAt.getTime() < VISIT_IDLE_MINUTES * 60 * 1000;
  const outcome = visitOutcome(visit);
  const who = customer ? customer.name || `+91 ${customer.phone}` : "Guest";

  const facts = [
    { label: "Visitor", value: who, href: customer && can(admin, "customers.view") ? `/admin/customers/${customer.id}` : undefined },
    { label: "Duration", value: formatDuration(durationMs) },
    { label: "Pages", value: String(visit.pageViews) },
    { label: "Actions", value: String(visit.eventCount) },
    { label: "Device", value: `${visit.device} · ${visit.browser} · ${visit.os}${visit.screen ? ` · ${visit.screen}` : ""}` },
    { label: "Source", value: describeSource(visit) },
    { label: "Entry page", value: visit.landingPath },
    { label: "Exit page", value: visit.exitPath },
  ];

  return (
    <div>
      <Link href="/admin/activity" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All visits
      </Link>
      <AdminPageHeader
        title={`Visit · ${who}`}
        subtitle={`${auditTime(visit.startedAt)} → ${timeIST(visit.lastSeenAt)}${visit.orderNumbers.length ? ` · ordered ${visit.orderNumbers.join(", ")}` : ""}`}
        action={
          <span className={cx("inline-block rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide", OUTCOME_TONE[outcome])}>
            {OUTCOME_LABEL[outcome]}
          </span>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest2">Timeline · {events.length}</h2>
            <div className="flex rounded-md border border-taupe/50 p-0.5 text-[10px] uppercase tracking-widest2">
              <Link href={`/admin/activity/${visit.id}`} className={cx("rounded px-3 py-1.5", !keyOnly ? "bg-moss text-paper" : "text-graphite hover:bg-sand/30")}>
                Everything
              </Link>
              <Link
                href={`/admin/activity/${visit.id}?steps=key`}
                className={cx("rounded px-3 py-1.5", keyOnly ? "bg-moss text-paper" : "text-graphite hover:bg-sand/30")}
              >
                Without clicks
              </Link>
            </div>
          </div>

          {events.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No steps recorded.</p>
          ) : (
            <ol className="relative overflow-hidden rounded-lg border border-taupe/30">
              {events.map((e, i) => {
                const Icon = ICON[e.type] ?? Circle;
                const key = KEY_EVENTS.has(e.type);
                const offset = formatDuration(e.at.getTime() - visit.startedAt.getTime());
                const order = (e.data as Record<string, unknown> | null)?.order;
                return (
                  <li
                    key={e.id}
                    className={cx(
                      "flex gap-3 px-4 py-2.5 text-sm",
                      i > 0 && "border-t border-taupe/15",
                      key && "bg-sand/30",
                      e.type === "page_view" && !key && "bg-paper"
                    )}
                  >
                    <span
                      className={cx(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        key ? "bg-moss text-paper" : e.type === "page_view" ? "bg-sand/60 text-ink" : "bg-taupe/15 text-graphite"
                      )}
                    >
                      <Icon size={12} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className={cx(key || e.type === "page_view" ? "font-medium" : "")}>{ACTIVITY_LABEL[e.type] ?? e.type}</span>
                        {e.source === "server" && (
                          <span className="rounded-full bg-moss/10 px-1.5 text-[9px] uppercase tracking-wide text-moss" title="Confirmed by the server">
                            confirmed
                          </span>
                        )}
                      </p>
                      <p className="break-all text-xs text-graphite">
                        {describeEvent(e)}
                        {typeof order === "string" && can(admin, "orders.view") && (
                          <>
                            {" · "}
                            <Link href={`/admin/orders?q=${encodeURIComponent(order)}`} className="text-moss underline underline-offset-2">
                              open order
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[11px] leading-tight text-ash">
                      {timeIST(e.at)}
                      <span className="block text-[10px]">+{offset}</span>
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center gap-3 border-t border-taupe/15 bg-sand/20 px-4 py-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                  {live ? <span className="h-2 w-2 animate-pulse rounded-full bg-sand" /> : <DoorOpen size={12} strokeWidth={1.75} />}
                </span>
                <p className="flex-1">
                  {live ? (
                    <span className="font-medium">Still browsing</span>
                  ) : (
                    <>
                      <span className="font-medium">Left the store</span>
                      <span className="block text-xs text-graphite">from {visit.exitPath}</span>
                    </>
                  )}
                </p>
                <span className="text-[11px] text-ash">{timeIST(visit.lastSeenAt)}</span>
              </li>
            </ol>
          )}
          {events.length === MAX_EVENTS && <p className="mt-2 text-xs text-ash">Showing the first {MAX_EVENTS} steps.</p>}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <dl className="rounded-lg border border-taupe/30 p-4 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 border-b border-taupe/15 py-2 first:pt-0 last:border-0 last:pb-0">
                <dt className="shrink-0 text-xs text-ash">{f.label}</dt>
                <dd className="min-w-0 break-all text-right">
                  {f.href ? (
                    <Link href={f.href} className="underline-offset-4 hover:underline">
                      {f.value}
                    </Link>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg bg-sand/25 p-4 text-xs text-graphite">
            <p className="font-mono text-[10px] text-ash">Browser {visit.visitorId.slice(0, 12)}</p>
            <p className="mt-1">
              {otherVisits === 0 ? "First visit from this browser." : `${otherVisits} other visit${otherVisits === 1 ? "" : "s"} from this browser.`}
            </p>
            {otherVisits > 0 && (
              <Link href={`/admin/activity?visitor=${visit.visitorId}&range=all`} className="mt-2 inline-block text-moss underline underline-offset-4">
                See all visits
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
