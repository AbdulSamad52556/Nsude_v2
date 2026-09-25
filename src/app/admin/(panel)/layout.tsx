import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/auth";
import { AdminShell } from "@/components/admin/AdminShell";

// Admin pages always read fresh data.
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects signed-out visitors; this is a second check.
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return <AdminShell>{children}</AdminShell>;
}
