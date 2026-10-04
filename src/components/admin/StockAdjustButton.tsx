"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { cx } from "@/lib/utils";
import { MANUAL_STOCK_REASONS, STOCK_REASONS, type ManualStockReason } from "@/lib/inventory";
import { Dialog, Field, inputClass, primaryButton } from "./Dialog";
import { Select } from "./Select";
import { apiFetch } from "./api";

type Mode = "add" | "remove" | "set";
const DEFAULT_REASON: Record<Mode, ManualStockReason> = { add: "restock", remove: "damaged", set: "correction" };

/** "Adjust" on an inventory row: restock, write off, or set a counted figure. */
export function StockAdjustButton({ code, name, stock }: { code: string; name: string; stock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ManualStockReason>("restock");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const qty = Number(quantity);
  const valid = quantity !== "" && Number.isInteger(qty) && qty >= 0 && (mode === "set" || qty > 0);
  const after = !valid ? null : mode === "add" ? stock + qty : mode === "remove" ? stock - qty : qty;

  function pickMode(m: Mode) {
    setMode(m);
    setReason(DEFAULT_REASON[m]);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Enter a whole number.");
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({ code, mode, quantity: qty, reason, ref: ref || undefined, note: note || undefined }),
      });
      setOpen(false);
      setQuantity("");
      setRef("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-taupe/50 px-3 text-[10px] uppercase tracking-widest2 text-graphite hover:border-moss hover:text-moss"
      >
        <SlidersHorizontal size={12} strokeWidth={1.5} /> Adjust
      </button>
      <Dialog open={open} title={`Adjust stock · ${name}`} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="text-sm text-graphite">
            In stock now: <span className="font-medium text-ink">{stock}</span>
          </p>
          <div role="radiogroup" aria-label="Change" className="grid grid-cols-3 rounded-md border border-taupe/50 p-0.5">
            {(
              [
                ["add", "Add"],
                ["remove", "Remove"],
                ["set", "Set count"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => pickMode(m)}
                className={cx(
                  "h-9 rounded text-[11px] uppercase tracking-widest2",
                  mode === m ? "bg-moss text-paper" : "text-graphite hover:bg-sand/30"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Field
            label={mode === "set" ? "Counted stock" : "Units"}
            hint={after !== null ? `Stock after: ${after}` : undefined}
            error={after !== null && after < 0 ? "That's more than is in stock." : undefined}
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
              autoFocus
              required
            />
          </Field>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value as ManualStockReason)}>
              {MANUAL_STOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {STOCK_REASONS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference (optional)" hint="Supplier invoice, order number…">
            <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} className={inputClass} />
          </Field>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputClass} />
          </Field>
          {error && <p className="text-xs text-rust">{error}</p>}
          <button type="submit" disabled={busy || !valid || (after !== null && after < 0)} className={primaryButton}>
            {busy && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </form>
      </Dialog>
    </>
  );
}
