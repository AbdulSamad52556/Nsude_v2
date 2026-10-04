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

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("users.view");
  if (!isObjectId(params.id)) notFound();
  const user = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!user) notFound();
  const [history, actions] = await Promise.all([
    db.auditLog.findMany({ where: { entity: "admin_user", entityId: user.id }, orderBy: { at: "desc" }, take: 100 }),
    // What this user has changed around the store.
    db.auditLog.findMany({ where: { actorType: "admin", actorLabel: user.email }, orderBy: { at: "desc" }, take: 20 }),
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
