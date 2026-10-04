import "server-only";
import { cache } from "react";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { can, normalizePermissions, type AdminIdentity, type Permission } from "@/lib/adminPermissions";
import { db } from "@/lib/server/db";

// Compare fixed-length digests so neither the length nor the content of the
// configured credentials leaks through response timing.
function safeEqual(a: string, b: string) {
  const da = createHash("sha256").update(a).digest();
  const dbuf = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, dbuf);
}

export function superadminEmail() {
  const email = process.env.ADMIN_EMAIL;
  if (!email || !process.env.ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  return email.trim().toLowerCase();
}

export function checkSuperadminCredentials(email: string, password: string) {
  const emailOk = safeEqual(email.trim().toLowerCase(), superadminEmail());
  const passwordOk = safeEqual(password, process.env.ADMIN_PASSWORD!);
  return emailOk && passwordOk;
}

/**
 * The signed-in admin, or null. Staff are re-checked against the database
 * (still active, password not changed since sign-in) and their permissions
 * read fresh, so changes apply on the next request. Cached per request.
 */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;

  if (session.role === "superadmin") {
    // A token for an old .env email stops working once the email changes.
    if (session.email !== superadminEmail()) return null;
    return { id: null, email: session.email, name: "Super admin", role: "superadmin", permissions: [] };
  }

  const user = await db.adminUser.findUnique({ where: { id: session.uid } });
  if (!user || !user.active || user.sessionVersion !== session.ver) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: "staff",
    permissions: normalizePermissions(user.permissions),
  };
});

/**
 * Guard for admin API handlers. Middleware already blocks signed-out
 * requests; this re-checks the account and, when given, the permission
 * (any one of a list). Superadmin passes every check.
 */
export async function requireAdmin(permission?: Permission | Permission[]) {
  const admin = await getAdmin();
  if (!admin) {
    return { session: null, admin: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const needed = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  if (needed.length > 0 && !needed.some((p) => can(admin, p))) {
    return {
      session: null,
      admin: null,
      error: NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 }),
    };
  }
  return { session: admin, admin, error: null };
}

/**
 * For admin pages: the signed-in admin, after checking the permission.
 * Signed-out → login; signed in without access → the "no access" page.
 */
export async function pageAdmin(permission?: Permission) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (permission && !can(admin, permission)) {
    redirect("/admin/no-access");
  }
  return admin;
}
