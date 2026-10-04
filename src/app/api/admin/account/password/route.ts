import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { passwordSchema } from "@/lib/server/adminUsers";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { fieldErrors } from "@/lib/validation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";

const bodySchema = z
  .object({ current: z.string().min(1, "Enter your current password").max(200), next: passwordSchema })
  .refine((b) => b.current !== b.next, { path: ["next"], message: "Choose a password different from the current one" });

// Wrong current-password guesses per user, so a left-open session can't be
// used to brute-force it: 5 per 15 minutes. In-memory, like admin login.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

/**
 * A signed-in admin user changes their own password. Other devices are
 * signed out; this one gets a fresh session. The superadmin's password
 * lives in .env, so it can't be changed here.
 */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (admin.role !== "staff" || !admin.id) {
    return NextResponse.json({ error: "The super admin password is set in the server's .env file." }, { status: 400 });
  }

  const record = failures.get(admin.id);
  if (record && Date.now() - record.first < WINDOW_MS && record.count >= MAX_FAILURES) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  const user = await db.adminUser.findUnique({ where: { id: admin.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    const fresh = !record || Date.now() - record.first >= WINDOW_MS;
    failures.set(admin.id, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
    return NextResponse.json(
      { error: "Current password is wrong", fields: { current: "That's not your current password" } },
      { status: 400 }
    );
  }
  failures.delete(admin.id);

  const updated = await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), sessionVersion: { increment: 1 } },
  });
  await recordAudit({
    actor: adminActor(user.email),
    entity: "admin_user",
    entityId: user.id,
    entityLabel: user.email,
    action: "Changed own password",
    changes: [{ field: "Password", from: "••••••", to: "Changed" }],
  });

  // Keep this device signed in with the new session version.
  const token = await createSessionToken({ email: updated.email, role: "staff", uid: updated.id, ver: updated.sessionVersion });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
