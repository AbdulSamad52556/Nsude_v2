"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-rust">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="group mt-2 flex h-12 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : "Sign In"}
        {!submitting && <ArrowRight size={16} strokeWidth={1.5} />}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm bg-paper p-8 md:p-10">
        <Image
          src="/brand/nsude-logo-dark.png"
          alt="NSUDE"
          width={482}
          height={172}
          priority
          className="mb-2 h-7 w-auto"
        />
        <p className="mb-8 text-xs uppercase tracking-widest2 text-ash">Admin</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
