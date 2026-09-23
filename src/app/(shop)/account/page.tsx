"use client";

import { useState, FormEvent } from "react";
import { ArrowRight } from "lucide-react";

export default function AccountPage() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-24 pt-32 md:pt-40">
      <h1 className="mb-2 text-display-md font-medium uppercase tracking-tighter text-ink">
        Account
      </h1>
      <p className="mb-10 text-center text-sm text-graphite">
        {mode === "sign-in" ? "Sign in to view orders and saved details." : "Create an account to track orders faster."}
      </p>

      {submitted ? (
        <p className="text-sm text-graphite" role="status">
          Thanks — this is a demo storefront, so accounts aren&apos;t active
          yet. Your order can still be tracked via the confirmation email.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
          <div>
            <label htmlFor="acc-email" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
              Email
            </label>
            <input
              id="acc-email"
              type="email"
              required
              className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="acc-password" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
              Password
            </label>
            <input
              id="acc-password"
              type="password"
              required
              className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="group mt-2 flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite"
          >
            {mode === "sign-in" ? "Sign In" : "Create Account"}
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "create" : "sign-in")}
            className="text-center text-xs uppercase tracking-widest2 text-graphite hover:text-ink"
          >
            {mode === "sign-in" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
