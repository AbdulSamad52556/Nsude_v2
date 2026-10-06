"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { ADMIN_MIN_PASSWORD } from "@/lib/adminPermissions";
import { ApiError, apiFetch } from "./api";

const inputClass =
  "h-10 w-full rounded-md border border-taupe/50 bg-transparent px-3 pr-10 text-sm focus:border-ink focus:outline-none";

/** An admin user changes their own password (current one required). */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    if (next.length < ADMIN_MIN_PASSWORD) return setErrors({ next: `Use at least ${ADMIN_MIN_PASSWORD} characters` });
    if (next !== confirm) return setErrors({ confirm: "Passwords don't match" });

    setBusy(true);
    try {
      await apiFetch("/api/admin/account/password", { method: "POST", body: JSON.stringify({ current, next }) });
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ tone: "ok", text: "Password changed. You've been signed out on your other devices." });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
    hint?: string
  ) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-ash">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => set(e.target.value)}
          autoComplete={autoComplete}
          className={inputClass}
          required
        />
        {id === "current" && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-ash hover:text-ink"
          >
            {show ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      {errors[id] ? (
        <p className="mt-1 text-xs text-rust">{errors[id]}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-ash">{hint}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-taupe/30 p-5">
      {field("current", "Current password", current, setCurrent, "current-password")}
      {field("next", "New password", next, setNext, "new-password", `At least ${ADMIN_MIN_PASSWORD} characters.`)}
      {field("confirm", "Confirm new password", confirm, setConfirm, "new-password")}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex h-11 items-center gap-2 rounded-md bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Change password
        </button>
        {message && (
          <p role="status" className={cx("flex items-center gap-1.5 text-xs", message.tone === "ok" ? "text-ink" : "text-rust")}>
            {message.tone === "ok" && <Check size={14} strokeWidth={2} />}
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
