import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { OTP_TTL_MS, hashOtp, newOtpCode } from "@/lib/server/customer";
import { SmsNotConfiguredError, otpOnScreen, sendOtpSms } from "@/lib/server/sms";
import { rateLimit } from "@/lib/server/rateLimit";
import { OTP_RESEND_SECONDS, phoneSchema } from "@/lib/account";
import { recordActivity } from "@/lib/server/activity";

// Sends a one-time login code to a mobile number. The same code signs in an
// existing customer or creates the account (see ../verify).
export const dynamic = "force-dynamic";

const MAX_CODES_PER_HOUR = 5;

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "otp-send", 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = phoneSchema.safeParse(body?.phone ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid mobile number" }, { status: 400 });
  }
  const phone = parsed.data;

  // Per number: a short wait between codes, and a cap per hour.
  const recent = await db.otpCode.findMany({
    where: { phone, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const waitMs = recent[0] ? recent[0].createdAt.getTime() + OTP_RESEND_SECONDS * 1000 - Date.now() : 0;
  if (waitMs > 0) {
    return NextResponse.json(
      { error: `Please wait ${Math.ceil(waitMs / 1000)}s before asking for a new code.`, retryAfter: Math.ceil(waitMs / 1000) },
      { status: 429 }
    );
  }
  if (recent.length >= MAX_CODES_PER_HOUR) {
    return NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 });
  }

  const code = newOtpCode();
  try {
    await sendOtpSms(phone, code);
  } catch (err) {
    if (err instanceof SmsNotConfiguredError) {
      console.error(err.message);
      return NextResponse.json({ error: "Phone login isn't available right now." }, { status: 503 });
    }
    throw err;
  }

  // Only the newest code is valid.
  await db.otpCode.deleteMany({ where: { phone } });
  await db.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  await recordActivity("otp_requested");
  return NextResponse.json({
    ok: true,
    resendIn: OTP_RESEND_SECONDS,
    // Until SMS is integrated, the code is shown on the login screen.
    ...(otpOnScreen() ? { screenCode: code } : {}),
  });
}
