import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Compare fixed-length digests so neither the length nor the content of the
// configured credentials leaks through response timing.
function safeEqual(a: string, b: string) {
  const da = createHash("sha256").update(a).digest();
  const dbuf = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, dbuf);
}

export function checkSuperadminCredentials(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = safeEqual(password, expectedPassword);
  return emailOk && passwordOk;
}

export async function getAdminSession() {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

/**
 * Guard for admin API handlers. Middleware already blocks unauthenticated
 * requests; this is a second check in case a route is ever reached some
 * other way (e.g. a matcher change).
 */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}
