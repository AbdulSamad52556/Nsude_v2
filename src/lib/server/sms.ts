import "server-only";

// Sends login codes by SMS. The provider is chosen with SMS_PROVIDER in .env:
//
//   (unset) or "console" — development only: the code is printed in the
//     server terminal and shown on the login screen. Refused on the live
//     site (NODE_ENV=production), so codes can never leak there.
//
// To go live, add a provider here (e.g. "msg91": call its OTP API with
// MSG91_AUTH_KEY / MSG91_TEMPLATE_ID) and set SMS_PROVIDER to it.

export class SmsNotConfiguredError extends Error {}

export function smsProvider() {
  return (process.env.SMS_PROVIDER || "console").toLowerCase();
}

/** True when codes are shown on screen instead of being sent (dev only). */
export function otpDevMode() {
  return smsProvider() === "console" && process.env.NODE_ENV !== "production";
}

export async function sendOtpSms(phone: string, code: string) {
  const provider = smsProvider();
  if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new SmsNotConfiguredError("No SMS provider is configured (set SMS_PROVIDER)");
    }
    console.info(`[otp] Login code for +91 ${phone}: ${code}`);
    return;
  }
  throw new SmsNotConfiguredError(`Unknown SMS_PROVIDER "${provider}"`);
}
