import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSuperadminCredentials } from "@/lib/server/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

// Simple per-IP throttle against password guessing: 5 failures per 15 min.
// In-memory, so it resets on restart and isn't shared across instances —
// fine for a single superadmin; move to a shared store if this scales out.
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
  const ok = parsed.success && checkSuperadminCredentials(parsed.data.email, parsed.data.password);

  if (!ok) {
    const fresh = !record || Date.now() - record.first >= WINDOW_MS;
    failures.set(ip, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  failures.delete(ip);
  const token = await createSessionToken({ email: parsed.data.email.toLowerCase(), role: "superadmin" });
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
