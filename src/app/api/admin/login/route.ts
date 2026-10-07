import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSuperadminCredentials, superadminEmail } from "@/lib/server/auth";
import { burnPasswordCheck, verifyPassword } from "@/lib/server/password";
import { db } from "@/lib/server/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, type AdminSession } from "@/lib/auth/session";
import { newVisitKey, recordActivity } from "@/lib/server/activity";
import { ADMIN_VISIT_COOKIE, ADMIN_VISIT_IDLE_MINUTES } from "@/lib/activity";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

// Simple per-IP throttle against password guessing: 5 failures per 15 min.
// In-memory, so it resets on restart and isn't shared across instances —
// fine for a small team; move to a shared store if this scales out.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const record = failures.get(ip);
  if (record && Date.now() - record.first < WINDOW_MS && record.count >= MAX_FAILURES) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const session = parsed.success ? await signIn(parsed.data.email, parsed.data.password) : null;

  if (!session) {
    const fresh = !record || Date.now() - record.first >= WINDOW_MS;
    failures.set(ip, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
    // A wrong password for a real admin account shows up in that user's
    // activity; attempts on unknown emails aren't tied to anyone.
    if (parsed.success && (await isAdminEmail(parsed.data.email))) {
      await recordActivity("sign_in_failed", {}, { area: "admin", adminEmail: parsed.data.email.trim().toLowerCase(), path: "/admin/login" });
    }
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  failures.delete(ip);
  const token = await createSessionToken(session);
  const response = NextResponse.json({ ok: true });

  // Each sign-in starts a new admin visit (Activity → Admin users).
  const visitKey = newVisitKey();
  await recordActivity(
    "signed_in",
    { role: session.role === "superadmin" ? "super admin" : "admin user" },
    { area: "admin", adminEmail: session.email, sessionKey: visitKey, path: "/admin/login" }
  );
  response.cookies.set(ADMIN_VISIT_COOKIE, visitKey, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_VISIT_IDLE_MINUTES * 60,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

async function isAdminEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  return email === superadminEmail() || Boolean(await db.adminUser.findUnique({ where: { email }, select: { id: true } }));
}

/** The .env superadmin first, then active admin users. */
async function signIn(rawEmail: string, password: string): Promise<AdminSession | null> {
  const email = rawEmail.trim().toLowerCase();
  if (checkSuperadminCredentials(email, password)) return { email, role: "superadmin" };

  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash)) || !user.active) return null;
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { email: user.email, role: "staff", uid: user.id, ver: user.sessionVersion };
}
