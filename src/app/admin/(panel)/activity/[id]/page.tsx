import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  History,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin, superadminEmail } from "@/lib/server/auth";
import { isObjectId } from "@/lib/server/revalidate";
import { can } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { ACTIVITY_LABEL, KEY_EVENTS, OUTCOME_LABEL, OUTCOME_TONE, VISIT_IDLE_MINUTES, visitOutcome } from "@/lib/activity";
import { describeEvent, describeSource, formatDuration, timeIST } from "@/lib/server/activityView";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { auditTime, entityHref } from "@/components/admin/AuditList";

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
  sign_in_failed: ShieldAlert,
  audit: History,
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
  const admin = await pageAdmin();
  if (!isObjectId(params.id)) notFound();
  const visit = await db.visitSession.findUnique({ where: { id: params.id } });
  if (!visit) notFound();

  // Shoppers' visits need Customer activity; admin users' sessions
  // (the super admin's included) need Admin user activity.
  const isAdminVisit = visit.area === "admin";
  if (!can(admin, isAdminVisit ? "admin_activity.view" : "activity.view")) redirect("/admin/no-access");

  const keyOnly = searchParams.steps === "key";
  const [events, customer, adminUser, otherVisits, saved] = await Promise.all([
    db.activityEvent.findMany({
      where: { sessionKey: visit.key, ...(keyOnly ? { type: { notIn: ["click", "page_leave"] } } : {}) },
      orderBy: { at: "asc" },
      take: MAX_EVENTS,
    }),
    visit.customerId ? db.customer.findUnique({ where: { id: visit.customerId } }) : null,
    isAdminVisit && visit.adminEmail ? db.adminUser.findUnique({ where: { email: visit.adminEmail } }) : null,
    db.visitSession.count({ where: { visitorId: visit.visitorId, area: visit.area, id: { not: visit.id } } }),
    // An admin's saved changes during this session, from Audit.
    isAdminVisit && visit.adminEmail
      ? db.auditLog.findMany({
          where: {
            actorType: "admin",
            actorLabel: visit.adminEmail,
            at: { gte: visit.startedAt, lte: new Date(visit.lastSeenAt.getTime() + 5000) },
          },
          orderBy: { at: "asc" },
        })
      : [],
  ]);

  // Steps, with the admin's saved changes (from Audit) merged in by time.
  type Row = (typeof events)[number] & { href?: string | null };
  const rows: Row[] = [
    ...events,
    ...saved.map((a) => ({
      id: `audit-${a.id}`,
      sessionKey: visit.key,
      visitorId: visit.visitorId,
      area: "admin",
      customerId: null,
      at: a.at,
      type: "audit",
      path: "",
      data: { action: a.action, entity: a.entityLabel, fields: a.changes.length },
      source: "server",
      expiresAt: visit.expiresAt,
      href: entityHref(a),
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const durationMs = visit.lastSeenAt.getTime() - visit.startedAt.getTime();
  // Signing out ends a session at once; otherwise it's over after 30 idle minutes.
  const signedOut = events.some((e) => e.type === "signed_out");
  const live = !signedOut && Date.now() - visit.lastSeenAt.getTime() < VISIT_IDLE_MINUTES * 60 * 1000;
  const outcome = visitOutcome(visit);
  const who = isAdminVisit
    ? (adminUser?.name ?? (visit.adminEmail === superadminEmail() ? "Super admin" : (visit.adminEmail ?? "Admin")))
    : customer
      ? customer.name || `+91 ${customer.phone}`
      : "Guest";
  const whoHref = isAdminVisit
    ? adminUser
      ? `/admin/users/${adminUser.id}`
      : undefined
    : customer && can(admin, "customers.view")
      ? `/admin/customers/${customer.id}`
      : undefined;

  const facts = [
    { label: isAdminVisit ? "Admin user" : "Visitor", value: who, href: whoHref },
    ...(isAdminVisit && visit.adminEmail ? [{ label: "Email", value: visit.adminEmail }] : []),
    { label: "Duration", value: formatDuration(durationMs) },
    { label: "Pages", value: String(visit.pageViews) },
    { label: "Actions", value: String(visit.eventCount) },
    ...(isAdminVisit ? [{ label: "Changes saved", value: String(saved.length) }] : []),
    { label: "Device", value: `${visit.device} · ${visit.browser} · ${visit.os}${visit.screen ? ` · ${visit.screen}` : ""}` },
    ...(isAdminVisit ? [] : [{ label: "Source", value: describeSource(visit) }]),
    { label: "Entry page", value: visit.landingPath },
    { label: "Exit page", value: visit.exitPath },
  ];

  return (
    <div>
      <Link
        href={isAdminVisit ? "/admin/activity?area=admin" : "/admin/activity"}
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={1.5} /> {isAdminVisit ? "All admin sessions" : "All visits"}
      </Link>
      <AdminPageHeader
        title={`${isAdminVisit ? "Session" : "Visit"} · ${who}`}
        subtitle={`${auditTime(visit.startedAt)} → ${timeIST(visit.lastSeenAt)}${visit.orderNumbers.length ? ` · ordered ${visit.orderNumbers.join(", ")}` : ""}`}
        action={
          isAdminVisit ? undefined : (
            <span className={cx("inline-block rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide", OUTCOME_TONE[outcome])}>
              {OUTCOME_LABEL[outcome]}
            </span>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest2">Timeline · {rows.length}</h2>
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

          {rows.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No steps recorded.</p>
          ) : (
            <ol className="relative overflow-hidden rounded-lg border border-taupe/30">
              {rows.map((e, i) => {
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
                        {e.href && (
                          <>
                            {" · "}
                            <Link href={e.href} className="text-moss underline underline-offset-2">
                              open
                            </Link>
                          </>
                        )}
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
                      <span className="font-medium">{signedOut ? "Signed out" : isAdminVisit ? "Session ended" : "Left the store"}</span>
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
              {otherVisits === 0 ? "First visit from this browser." : `${otherVisits} other ${isAdminVisit ? "session" : "visit"}${otherVisits === 1 ? "" : "s"} from this browser.`}
            </p>
            {otherVisits > 0 && !isAdminVisit && (
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
