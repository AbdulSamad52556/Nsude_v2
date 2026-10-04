import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/server/auth";
import { AdminShell } from "@/components/admin/AdminShell";

// Admin pages always read fresh data.
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects signed-out visitors; this also catches
  // deactivated users and sessions from before a password change.
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
