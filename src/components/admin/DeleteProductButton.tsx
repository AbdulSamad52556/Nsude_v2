"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "./api";

export function DeleteProductButton({
  id,
  name,
  redirectTo,
  variant = "icon",
}: {
  id: string;
  name: string;
  /** Where to go after deleting (e.g. back to the list from the edit page). */
  redirectTo?: string;
  variant?: "icon" | "button";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      `Delete "${name}"?\n\nThis removes the product, its images, and any hero slide that uses it. This can't be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
      setBusy(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="flex h-11 items-center gap-2 border border-rust/40 px-5 text-xs uppercase tracking-widest2 text-rust hover:bg-rust hover:text-bone disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
        Delete
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      aria-label={`Delete ${name}`}
      className="p-2 text-ash hover:text-rust disabled:opacity-60"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
    </button>
  );
}
