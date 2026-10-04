"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { ADMIN_MIN_PASSWORD as MIN_PASSWORD, PERMISSION_AREAS, normalizePermissions, type Permission } from "@/lib/adminPermissions";
import type { AdminUserView } from "@/lib/server/adminUsers";
import { ApiError, apiFetch } from "./api";

type Level = "none" | "view" | "manage";

const inputClass =
  "h-10 w-full rounded-md border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none";

function levelOf(perms: Permission[], area: string): Level {
  if (perms.includes(`${area}.manage` as Permission)) return "manage";
  if (perms.includes(`${area}.view` as Permission)) return "view";
  return "none";
}

/** A readable random password the super admin can hand over. */
function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Create or edit an admin user: details, password, and per-area access. */
export function AdminUserForm({
  user,
  grantable,
}: {
  user?: AdminUserView;
  /** Access the signed-in admin may hand out; other levels are greyed out. */
  grantable: Permission[];
}) {
  const router = useRouter();
  const editing = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [active, setActive] = useState(user?.active ?? true);
  const [perms, setPerms] = useState<Permission[]>(user?.permissions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  function setLevel(area: string, level: Level) {
    const rest = perms.filter((p) => !p.startsWith(`${area}.`));
    const add = level === "manage" ? [`${area}.manage`, `${area}.view`] : level === "view" ? [`${area}.view`] : [];
    setPerms(normalizePermissions([...rest, ...add]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    if (!editing && password.length < MIN_PASSWORD) {
      setErrors({ password: `Use at least ${MIN_PASSWORD} characters` });
      return;
    }
    setBusy("save");
    try {
      const body = JSON.stringify({ name, email, password, active, permissions: perms });
      if (editing) {
        await apiFetch(`/api/admin/users/${user!.id}`, { method: "PATCH", body });
        setPassword("");
        setMessage({
          tone: "ok",
          text: password ? "Saved. The new password signs them out of every device." : "Saved. Changes apply on their next click.",
        });
        router.refresh();
      } else {
        const { user: created } = await apiFetch<{ user: AdminUserView }>("/api/admin/users", { method: "POST", body });
        router.push(`/admin/users/${created.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!user) return;
    if (!window.confirm(`Remove ${user.name}?\n\nThey'll be signed out and can't sign in to admin again.`)) return;
    setBusy("delete");
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="flex flex-col gap-4 rounded-lg border border-taupe/30 p-5">
        <h2 className="text-xs uppercase tracking-widest2">Details</h2>
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} required />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="off"
            required
          />
        </Field>
        <Field
          label={editing ? "New password" : "Password"}
          hint={editing ? "Leave blank to keep the current one." : `At least ${MIN_PASSWORD} characters.`}
          error={errors.password}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cx(inputClass, "pr-10")}
                autoComplete="new-password"
                required={!editing}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-ash hover:text-moss"
              >
                {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
              className="flex h-10 items-center gap-1.5 rounded-md border border-taupe/50 px-3 text-[11px] uppercase tracking-widest2 text-graphite hover:border-moss hover:text-moss"
            >
              <RefreshCw size={13} strokeWidth={1.5} /> Generate
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-md bg-sand/25 px-3 py-2.5">
          <div>
            <p className="text-sm">Can sign in</p>
            <p className="text-[11px] text-ash">Turn off to block access without deleting the user.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Can sign in"
            onClick={() => setActive((v) => !v)}
            className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", active ? "bg-moss" : "bg-taupe/60")}
          >
            <span
              className={cx(
                "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform",
                active ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-taupe/30 p-5">
        <h2 className="text-xs uppercase tracking-widest2">Access</h2>
        <p className="mt-1 text-[11px] text-ash">Manage includes view. You can only give access you have yourself.</p>
        <ul className="mt-4 divide-y divide-taupe/20">
          {PERMISSION_AREAS.map((area) => {
            const level = levelOf(perms, area.key);
            const levels: Level[] = "manage" in area ? ["none", "view", "manage"] : ["none", "view"];
            return (
              <li key={area.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{area.label}</p>
                  <p className="text-[11px] text-ash">
                    {level === "manage" && "manage" in area ? area.manage : area.view}
                  </p>
                </div>
                <div role="radiogroup" aria-label={`${area.label} access`} className="flex rounded-md border border-taupe/50 p-0.5">
                  {levels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={level === l}
                      // Can't give, or take away, more than you have.
                      disabled={
                        !grantable.includes(`${area.key}.${l === "none" ? "view" : l}` as Permission) ||
                        (level === "manage" && !grantable.includes(`${area.key}.manage` as Permission))
                      }
                      onClick={() => setLevel(area.key, l)}
                      className={cx(
                        "h-7 rounded px-3 text-[10px] uppercase tracking-widest2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        level === l
                          ? l === "none"
                            ? "bg-taupe/30 text-ink"
                            : "bg-moss text-paper"
                          : "text-graphite hover:bg-sand/30"
                      )}
                    >
                      {l === "none" ? "No access" : l}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button
          type="submit"
          disabled={busy !== null}
          className="flex h-11 items-center gap-2 rounded-md bg-moss px-6 text-xs uppercase tracking-widest2 text-paper hover:brightness-90 disabled:opacity-60"
        >
          {busy === "save" && <Loader2 size={15} className="animate-spin" />}
          {editing ? "Save changes" : "Create user"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="flex h-11 items-center gap-2 rounded-md border border-rust/40 px-5 text-xs uppercase tracking-widest2 text-rust hover:bg-rust hover:text-paper disabled:opacity-60"
          >
            {busy === "delete" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} strokeWidth={1.5} />}
            Remove user
          </button>
        )}
        {message && (
          <p role="status" className={cx("text-xs", message.tone === "ok" ? "text-moss" : "text-rust")}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-ash">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rust">{error}</span> : hint && <span className="mt-1 block text-[11px] text-ash">{hint}</span>}
    </label>
  );
}
