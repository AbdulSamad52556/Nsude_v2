import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { OTP_MAX_ATTEMPTS, otpMatches, startCustomerSession, toAccountData } from "@/lib/server/customer";
import { rateLimit } from "@/lib/server/rateLimit";
import { customerActor, recordAudit } from "@/lib/server/audit";
import { otpSchema, phoneSchema } from "@/lib/account";
import { linkVisitorToCustomer, recordActivity } from "@/lib/server/activity";

// Checks a login code. On success the customer is signed in — and if this
// number has never been used, the account is created right here.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "otp-verify", 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const phone = phoneSchema.safeParse(body?.phone ?? "");
  const code = otpSchema.safeParse(body?.code ?? "");
  if (!phone.success) return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
  if (!code.success) return NextResponse.json({ error: code.error.issues[0]?.message }, { status: 400 });

  const otp = await db.otpCode.findFirst({ where: { phone: phone.data }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) {
    return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 400 });
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many wrong attempts. Request a new code." }, { status: 400 });
  }
  if (!otpMatches(phone.data, code.data, otp.codeHash)) {
    const { attempts } = await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return NextResponse.json(
      { error: left > 0 ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong attempts. Request a new code." },
      { status: 400 }
    );
  }

  await db.otpCode.deleteMany({ where: { phone: phone.data } });
  const existing = await db.customer.findUnique({ where: { phone: phone.data } });
  const customer = existing ?? (await db.customer.create({ data: { phone: phone.data } }));
  if (!existing) {
    await recordAudit({
      actor: customerActor(customer.phone),
      entity: "customer",
      entityId: customer.id,
      entityLabel: `+91 ${customer.phone}`,
      action: "Account created",
      changes: [{ field: "Mobile number", from: "—", to: `+91 ${customer.phone}` }],
    });
  }

  // Guest orders placed earlier with this (now verified) number become part
  // of the account, however long ago they were placed.
  await db.order
    .updateMany({
      // Unlinked = no account yet (orders from before accounts have no field).
      where: { phone: phone.data, OR: [{ customerId: null }, { customerId: { isSet: false } }] },
      data: { customerId: customer.id },
    })
    .catch((err) => console.error("Linking guest orders failed", err));

  // Access token (1 hour) + refresh token (30 days from last use) cookies.
  await startCustomerSession(customer.id, request.headers.get("user-agent") ?? "");
  // This browser's visits so far (as a guest) now belong to the customer.
  await linkVisitorToCustomer(customer.id);
  await recordActivity(existing ? "signed_in" : "signed_up", {}, { customerId: customer.id });
  return NextResponse.json({ account: toAccountData(customer), isNew: !existing });
}
