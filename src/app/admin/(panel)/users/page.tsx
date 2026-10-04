import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin, superadminEmail } from "@/lib/server/auth";
import { can, describePermissions } from "@/lib/adminPermissions";
import { cx } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { auditTime } from "@/components/admin/AuditList";

export const metadata = { title: "Users" };

type Search = { page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/users${s ? `?${s}` : ""}`;
}

/** Who can sign in to admin and what each can do. */
export default async function UsersPage({ searchParams }: { searchParams: Search }) {
  const admin = await pageAdmin("users.view");
  const total = await db.adminUser.count();
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const users = await db.adminUser.findMany({ orderBy: { createdAt: "desc" }, skip, take: size });

  return (
    <div>
      <AdminPageHeader
        title="Users"
        subtitle={`${total} user${total === 1 ? "" : "s"} besides the super admin.`}
        action={
          can(admin, "users.manage") && (
            <Link
              href="/admin/users/new"
              className="flex h-11 items-center gap-2 rounded-md bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
            >
              <Plus size={16} strokeWidth={1.5} /> New User
            </Link>
          )
        }
      />

      {/* The .env account: fixed, full access, can't be edited here. */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-sand bg-sand/25 p-4 text-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss text-paper">
          <ShieldCheck size={16} strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="truncate">
            {superadminEmail()}
            {admin.role === "superadmin" && <span className="ml-1 text-xs text-ash">(you)</span>}
          </p>
          <p className="text-xs text-graphite">Super admin · full access · set in the server&apos;s .env</p>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">
          No other users yet. Add one to give someone access to parts of admin.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Name</th>
                <th className="p-3 font-normal">Access</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3 font-normal">Last sign-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-sand/15">
                  <td className="p-3">
                    <Link href={`/admin/users/${u.id}`} className="underline-offset-4 hover:underline">
                      {u.name}
                    </Link>
                    {u.id === admin.id && <span className="ml-1 text-xs text-ash">(you)</span>}
                    <p className="text-xs text-ash">{u.email}</p>
                  </td>
                  <td className="max-w-xs p-3 text-xs text-graphite">{describePermissions(u.permissions)}</td>
                  <td className="p-3">
                    <span
                      className={cx(
                        "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        u.active ? "border-moss bg-moss text-paper" : "border-ash/30 text-ash"
                      )}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-graphite">
                    {u.lastLoginAt ? auditTime(u.lastLoginAt) : <span className="text-ash">Never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} size={size} total={total} noun={total === 1 ? "user" : "users"} href={href} />
    </div>
  );
}
