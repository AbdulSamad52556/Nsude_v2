"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Smartphone } from "lucide-react";
import { cx } from "@/lib/utils";
import { OTP_LENGTH, phoneSchema, type AccountData } from "@/lib/account";

async function postJson<T>(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T & { error?: string; retryAfter?: number } };
}

const fieldClass =
  "h-10 w-full rounded-md border border-graphite/20 bg-transparent px-3 text-sm text-ink placeholder:text-ash/60 focus:border-ink focus:outline-none md:h-11";

/**
 * Log in or sign up with a mobile number: send a one-time code, then enter
 * it. The same flow creates the account the first time a number is used.
 */
export function PhoneLogin({ onSignedIn }: { onSignedIn: (account: AccountData, isNew: boolean) => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Countdown until another code can be requested.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const normalized = phoneSchema.safeParse(phone);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!normalized.success) {
      setError(normalized.error.issues[0]?.message ?? "Enter a valid mobile number");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await postJson<{ resendIn: number; devCode?: string }>("/api/auth/otp/send", { phone: normalized.data });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error ?? "Couldn't send the code. Try again.");
      if (res.data.retryAfter) setResendIn(res.data.retryAfter);
      return;
    }
    setDevCode(res.data.devCode ?? null);
    setResendIn(res.data.resendIn);
    setCode("");
    setStep("code");
    window.setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(value = code) {
    if (busy || !normalized.success) return;
    if (value.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await postJson<{ account: AccountData; isNew: boolean }>("/api/auth/otp/verify", {
      phone: normalized.data,
      code: value,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error ?? "Couldn't verify the code. Try again.");
      setCode("");
      codeRef.current?.focus();
      return;
    }
    onSignedIn(res.data.account, res.data.isNew);
  }

  return (
    <div className="flex w-full flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-moss/10 text-moss md:h-16 md:w-16">
        <Smartphone size={24} strokeWidth={1.5} />
      </span>
      <h1 className="mt-5 text-xl font-medium uppercase tracking-tighter text-ink md:text-display-md">
        {step === "phone" ? "Log in or sign up" : "Enter the code"}
      </h1>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-graphite md:text-sm">
        {step === "phone" ? (
          "Use your mobile number — we'll text you a one-time code. No password needed."
        ) : (
          <>
            We sent a {OTP_LENGTH}-digit code to <span className="text-ink">+91 {normalized.success ? normalized.data : phone}</span>.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="text-moss underline underline-offset-4"
            >
              Change
            </button>
          </>
        )}
      </p>

      <div className="mt-7 w-full max-w-xs rounded-lg border border-graphite/10 bg-paper p-4 text-left shadow-[0_1px_6px_rgba(10,10,10,0.07)] md:p-5">
        {step === "phone" ? (
          <form onSubmit={sendCode} noValidate>
            <label htmlFor="login-phone" className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
              Mobile number
            </label>
            <div
              className={cx(
                "flex h-10 items-center overflow-hidden rounded-md border focus-within:border-ink md:h-11",
                error ? "border-rust" : "border-graphite/20"
              )}
            >
              <span className="border-r border-graphite/15 px-3 text-sm text-ash">+91</span>
              <input
                id="login-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                }}
                placeholder="10-digit mobile number"
                className="h-full w-full bg-transparent px-3 text-sm text-ink placeholder:text-ash/60 focus:outline-none"
              />
            </div>
            {error && <p className="mt-1.5 text-[11px] text-rust">{error}</p>}
            <button
              type="submit"
              disabled={busy || !normalized.success}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 disabled:cursor-not-allowed disabled:bg-graphite/40 md:h-11"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Send code
              {!busy && <ArrowRight size={15} strokeWidth={1.5} />}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
            noValidate
          >
            {devCode && (
              <p className="mb-3 rounded-md bg-moss/10 px-3 py-2 text-[11px] text-moss">
                Development mode (no SMS set up): your code is <span className="font-medium tracking-widest">{devCode}</span>
              </p>
            )}
            <label htmlFor="login-code" className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
              {OTP_LENGTH}-digit code
            </label>
            <input
              ref={codeRef}
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                setCode(v);
                setError(null);
                if (v.length === OTP_LENGTH) verify(v);
              }}
              className={cx(fieldClass, "text-center text-base tracking-[0.5em]", error && "border-rust")}
            />
            {error && <p className="mt-1.5 text-[11px] text-rust">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== OTP_LENGTH}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 disabled:cursor-not-allowed disabled:bg-graphite/40 md:h-11"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Verify &amp; continue
            </button>
            <p className="mt-3 text-center text-[11px] text-ash">
              {resendIn > 0 ? (
                `Resend code in ${resendIn}s`
              ) : (
                <button type="button" onClick={() => sendCode()} className="text-moss underline underline-offset-4">
                  Resend code
                </button>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
