import { pageAdmin } from "@/lib/server/auth";
import { describePermissions } from "@/lib/adminPermissions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export const metadata = { title: "My Password" };

/** A signed-in admin user's own password. */
export default async function AccountPage() {
  const admin = await pageAdmin();
  return (
    <div>
      <AdminPageHeader title="My Password" subtitle={`${admin.name} · ${admin.email}`} />
      {admin.role === "superadmin" ? (
        <p className="max-w-md rounded-lg border border-taupe/30 p-6 text-sm text-graphite">
          The super admin password is set in the server&apos;s <code>.env</code> file (<code>ADMIN_PASSWORD</code>). Change it
          there and restart the server.
        </p>
      ) : (
        <div className="grid max-w-3xl gap-6 md:grid-cols-[1fr_240px]">
          <ChangePasswordForm />
          <div className="h-fit rounded-lg bg-sand/25 p-4 text-xs leading-relaxed text-graphite">
            <p className="mb-1 uppercase tracking-widest2 text-ash">Your access</p>
            {describePermissions(admin.permissions)}
            <p className="mt-3 text-ash">Only the super admin can change what you can access.</p>
          </div>
        </div>
      )}
    </div>
  );
}
