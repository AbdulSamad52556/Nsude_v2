"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { cx } from "@/lib/utils";
import { ActivityTracker } from "@/components/layout/ActivityTracker";

const inputClass =
  "h-11 w-full rounded-md border border-graphite/20 bg-transparent px-3 text-sm text-ink placeholder:text-ash/60 transition-colors focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/15";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      // Only follow same-site admin paths from ?next=.
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[11px] uppercase tracking-widest text-ash">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@nsude.com"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[11px] uppercase tracking-widest text-ash">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={cx(inputClass, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ash transition-colors hover:text-moss"
          >
            {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rust/30 bg-rust/5 p-3 text-xs text-rust">
          <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 disabled:cursor-not-allowed disabled:bg-graphite/40"
      >
        {submitting ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight size={15} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="flex min-h-[100svh] flex-col items-center justify-center bg-moss px-5 py-12">
      {/* Starts the admin visit, so the sign-in (or failed attempts) is part of it. */}
      <ActivityTracker />
      <Image
        src="/brand/nsude-logo-light.png"
        alt="NSUDE"
        width={482}
        height={172}
        priority
        className="mb-8 h-8 w-auto"
      />

      <div className="w-full max-w-sm rounded-lg bg-paper p-6 shadow-[0_12px_40px_rgba(10,10,10,0.25)] md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moss/10 text-moss">
            <Lock size={17} strokeWidth={1.5} />
          </span>
          <div>
            <h1 className="text-base font-medium uppercase tracking-tighter text-ink">Admin sign in</h1>
            <p className="text-[12px] text-ash">Manage orders, products and the store.</p>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest2 text-paper/70 transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} strokeWidth={1.5} /> Back to store
      </Link>
    </main>
  );
}
