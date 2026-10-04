import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getAdmin } from "@/lib/server/auth";
import { recordActivity } from "@/lib/server/activity";
import { ADMIN_VISIT_COOKIE } from "@/lib/activity";

export async function POST() {
  const admin = await getAdmin();
  if (admin) await recordActivity("signed_out", {}, { area: "admin", adminEmail: admin.email });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  // The admin visit ends here; the next sign-in starts a new one.
  response.cookies.set(ADMIN_VISIT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
