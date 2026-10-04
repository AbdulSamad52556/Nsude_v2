import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pageAdmin } from "@/lib/server/auth";
import { grantableFor } from "@/lib/adminPermissions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminUserForm } from "@/components/admin/AdminUserForm";

export const metadata = { title: "New User" };

export default async function NewUserPage() {
  const admin = await pageAdmin("users.manage");
  return (
    <div>
      <Link href="/admin/users" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All users
      </Link>
      <AdminPageHeader title="New User" subtitle="They sign in at /admin with this email and password." />
      <AdminUserForm grantable={grantableFor(admin)} />
    </div>
  );
}
