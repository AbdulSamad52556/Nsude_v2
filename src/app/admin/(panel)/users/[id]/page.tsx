import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can, canManageUser, grantableFor } from "@/lib/adminPermissions";
import { isObjectId } from "@/lib/server/revalidate";
import { toAdminUserView } from "@/lib/server/adminUsers";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { AuditList, auditTime } from "@/components/admin/AuditList";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { formatDuration } from "@/lib/server/activityView";
import { VISIT_IDLE_MINUTES } from "@/lib/activity";

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("users.view");
  if (!isObjectId(params.id)) notFound();
  const user = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!user) notFound();
  const [history, actions, sessions] = await Promise.all([
    db.auditLog.findMany({ where: { entity: "admin_user", entityId: user.id }, orderBy: { at: "desc" }, take: 100 }),
    // What this user has changed around the store.
    db.auditLog.findMany({ where: { actorType: "admin", actorLabel: user.email }, orderBy: { at: "desc" }, take: 20 }),
    // Their admin-panel sessions (Activity → Admin users).
    can(admin, "admin_activity.view")
      ? db.visitSession.findMany({ where: { area: "admin", adminEmail: user.email }, orderBy: { startedAt: "desc" }, take: 10 })
      : [],
  ]);

  return (
    <div>
      <Link href="/admin/users" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All users
      </Link>
      <AdminPageHeader
        title={user.name}
        subtitle={`${user.email} · added ${auditTime(user.createdAt)}${user.lastLoginAt ? ` · last signed in ${auditTime(user.lastLoginAt)}` : " · never signed in"}`}
      />
      {user.id === admin.id && (
        <p className="mb-6 rounded-md bg-sand/40 px-3 py-2 text-xs text-ink">
          This is you. You can&apos;t change your own access; use My Password to change your password.
        </p>
      )}
      <ReadOnly when={!canManageUser(admin, user)} note={user.id !== admin.id}>
        <AdminUserForm user={toAdminUserView(user)} grantable={grantableFor(admin)} />
      </ReadOnly>

      {can(admin, "admin_activity.view") && (
        <section className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest2">Recent sessions</h2>
            <Link
              href={`/admin/activity?area=admin&user=${encodeURIComponent(user.email)}&range=all`}
              className="text-[11px] uppercase tracking-widest2 text-ash hover:text-moss"
            >
              All sessions
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">No sessions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-taupe/20 overflow-hidden rounded-lg border border-taupe/30">
              {sessions.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/activity/${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm hover:bg-sand/15">
                    <span>{auditTime(v.startedAt)}</span>
                    <span className="text-xs text-ash">
                      {v.pageViews} page{v.pageViews === 1 ? "" : "s"} · {formatDuration(v.lastSeenAt.getTime() - v.startedAt.getTime())} · {v.device} ·{" "}
                      {v.browser}
                    </span>
                    {Date.now() - v.lastSeenAt.getTime() < VISIT_IDLE_MINUTES * 60 * 1000 && (
                      <span className="ml-auto rounded-full border border-moss bg-moss px-2 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                        Active now
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {can(admin, "audit.view") && (
        <>
          <section className="mt-12">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Recent changes by {user.name}</h2>
            <AuditList entries={actions} empty="Hasn't changed anything yet." />
          </section>
          <section className="mt-12">
            <h2 className="mb-3 text-xs uppercase tracking-widest2">Audit</h2>
            <AuditList entries={history} showEntity={false} empty="No edits recorded yet." />
          </section>
        </>
      )}
    </div>
  );
}
