import "server-only";

// Sends login codes. The provider is chosen with SMS_PROVIDER in .env:
//
//   (unset) or "screen" — for now, until SMS is integrated: no SMS is sent;
//     the code is shown on the login screen (and printed in the server
//     terminal). NOTE: while this is on, anyone who types a number gets its
//     code, so any account can be opened — switch to a real provider before
//     customers rely on accounts.
//
// To integrate SMS later, add a provider here (e.g. "msg91": call its OTP API
// with MSG91_AUTH_KEY / MSG91_TEMPLATE_ID) and set SMS_PROVIDER to it; the
// code then stops being shown on screen automatically.

export class SmsNotConfiguredError extends Error {}

export function smsProvider() {
  const provider = (process.env.SMS_PROVIDER || "screen").toLowerCase();
  return provider === "console" ? "screen" : provider; // old name
}

/** True while codes are shown on the login screen instead of sent by SMS. */
export function otpOnScreen() {
  return smsProvider() === "screen";
}

export async function sendOtpSms(phone: string, code: string) {
  const provider = smsProvider();
  if (provider === "screen") {
    console.info(`[otp] Login code for +91 ${phone}: ${code}`);
    return;
  }
  throw new SmsNotConfiguredError(`Unknown SMS_PROVIDER "${provider}"`);
}
