"use client";

import { ArrowRight, Check } from "lucide-react";
import { FormEvent, useState } from "react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubmitted(true);
    setEmail("");
  }

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-xl font-medium uppercase tracking-tighter text-bone">
        Join the NSUDE list
      </h3>
      <p className="max-w-xs text-sm leading-relaxed text-mist">
        New releases, restocks, and the occasional word from the studio. No noise.
      </p>
      {submitted ? (
        <p className="flex items-center gap-2 text-sm text-bone" role="status">
          <Check size={16} aria-hidden /> You&apos;re on the list.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex max-w-sm border-b border-graphite pb-2">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder="EMAIL ADDRESS"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-sm uppercase tracking-wide text-bone placeholder:text-stone focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Subscribe"
            className="flex shrink-0 items-center gap-1 text-xs uppercase tracking-widest2 text-bone transition-opacity hover:opacity-60"
          >
            Subscribe <ArrowRight size={14} aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
