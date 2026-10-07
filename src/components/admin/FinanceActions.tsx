"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Banknote, Loader2, RotateCcw } from "lucide-react";
import { formatPaise } from "@/lib/finance";
import { Dialog, Field, inputClass, primaryButton } from "./Dialog";
import { Select } from "./Select";
import { apiFetch } from "./api";

const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** "Mark cash received" (COD) or "Mark refunded" for one order. */
export function OrderMoneyButton({
  orderId,
  orderNumber,
  amountPaise,
  action,
  compact = false,
}: {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  action: "cash_received" | "paid" | "refunded";
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(action === "refunded" ? "upi" : "cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Money coming in (COD cash, admin order paid) vs going back out (refund).
  const cash = action !== "refunded";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/orders/${orderId}/payment`, {
        method: "POST",
        body: JSON.stringify({ action, method, reference: reference || undefined, date }),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Icon = cash ? Banknote : RotateCcw;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-taupe/50 px-3 text-[10px] uppercase tracking-widest2 text-graphite hover:border-ink hover:text-ink"
            : "flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-[11px] uppercase tracking-widest2 text-paper hover:bg-graphite"
        }
      >
        <Icon size={compact ? 12 : 14} strokeWidth={1.5} />{" "}
        {action === "cash_received" ? "Mark cash received" : action === "paid" ? "Mark paid" : "Mark refunded"}
      </button>
      <Dialog open={open} title={`${action === "cash_received" ? "Cash received" : action === "paid" ? "Payment received" : "Refund paid"} · ${orderNumber}`} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="text-sm text-graphite">
            {cash ? "Adds" : "Takes"} <span className="font-medium text-ink">{formatPaise(amountPaise)}</span>{" "}
            {cash ? "to" : "from"} the company balance in Finance.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={cash ? "Received as" : "Paid back by"}>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                {action === "paid" && <option value="card">Card</option>}
                {!cash && <option value="razorpay">Razorpay refund</option>}
              </Select>
            </Field>
            <Field label="Date">
              <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Reference (optional)" hint={cash ? "Courier remittance id, UPI id…" : "Refund id, UPI id…"}>
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={inputClass} />
          </Field>
          {error && <p className="text-xs text-rust">{error}</p>}
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy && <Loader2 size={15} className="animate-spin" />} Confirm
          </button>
        </form>
      </Dialog>
    </>
  );
}

/** Voids a finance entry entered by mistake (kept, but not counted). */
export function VoidEntryButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/finance/${id}`, { method: "PATCH", body: JSON.stringify({ voidReason: reason }) });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Void ${label}`} title="Void" className="p-1.5 text-ash hover:text-rust">
        <Ban size={14} strokeWidth={1.5} />
      </button>
      <Dialog open={open} title="Void entry" onClose={() => setOpen(false)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="text-sm text-graphite">
            <span className="font-medium text-ink">{label}</span> stays in the ledger, crossed out, and stops counting towards the
            balance.
          </p>
          <Field label="Why">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} required autoFocus />
          </Field>
          {error && <p className="text-xs text-rust">{error}</p>}
          <button
            type="submit"
            disabled={busy || reason.trim().length < 3}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-rust px-6 text-xs uppercase tracking-widest2 text-paper hover:brightness-90 disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Void entry
          </button>
        </form>
      </Dialog>
    </>
  );
}

