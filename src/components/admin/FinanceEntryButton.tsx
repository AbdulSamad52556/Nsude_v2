"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cx } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  FINANCE_TYPES,
  MANUAL_TYPES,
  PAYMENT_METHODS_FINANCE,
  parseRupees,
  formatPaise,
  type ManualType,
} from "@/lib/finance";
import { Dialog, Field, inputClass, primaryButton } from "./Dialog";
import { Select } from "./Select";
import { ApiError, apiFetch } from "./api";

type Employee = { email: string; name: string };
type EntryType = ManualType | "opening";

const TAB_LABEL: Record<ManualType, string> = {
  expense: "Expense",
  employee_withdrawal: "Employee takes",
  employee_deposit: "Employee adds",
  income: "Other income",
  adjustment: "Correction",
};

const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/**
 * Adds money in or out of the company by hand. `opening` sets the starting
 * bank balance (shown until it's set).
 */
export function FinanceEntryButton({
  employees,
  initialType = "expense",
  label,
  variant = "primary",
}: {
  employees: Employee[];
  initialType?: EntryType;
  label?: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EntryType>(initialType);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("bank");
  const [category, setCategory] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const paise = parseRupees(amount);
  const sign = type === "opening" || type === "adjustment" ? (direction === "out" ? -1 : 1) : FINANCE_TYPES[type].sign;
  const isEmployee = type === "employee_withdrawal" || type === "employee_deposit";

  function reset() {
    setAmount("");
    setDescription("");
    setReference("");
    setCategory("");
    setEmployeeEmail("");
    setDate(today());
    setErrors({});
    setMessage(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    setBusy(true);
    try {
      await apiFetch("/api/admin/finance", {
        method: "POST",
        body: JSON.stringify({
          type,
          amount,
          direction,
          date,
          method,
          category: type === "expense" ? category : undefined,
          employeeEmail: isEmployee ? employeeEmail : undefined,
          description: description || undefined,
          reference: reference || undefined,
        }),
      });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setType(initialType);
          setOpen(true);
        }}
        className={
          variant === "primary"
            ? "flex h-11 items-center gap-2 rounded-md bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
            : "flex h-10 items-center gap-2 rounded-md border border-taupe/50 px-4 text-[11px] uppercase tracking-widest2 text-graphite hover:border-moss hover:text-moss"
        }
      >
        <Plus size={15} strokeWidth={1.5} /> {label ?? "New entry"}
      </button>
      <Dialog open={open} title={type === "opening" ? "Opening balance" : "New money entry"} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          {type === "opening" ? (
            <p className="text-sm text-graphite">
              The money in the company&apos;s bank account right now. Everything after this — orders, expenses, employees&apos;
              money — moves this balance.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
              {MANUAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => {
                    setType(t);
                    setErrors({});
                  }}
                  className={cx(
                    "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
                    type === t ? "border-moss bg-moss text-paper" : "border-taupe/50 text-graphite hover:border-moss"
                  )}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
          )}

          {isEmployee && (
            <Field label={type === "employee_withdrawal" ? "Who took the money" : "Who added the money"} error={errors.employeeEmail}>
              <Select value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} required>
                <option value="">Choose…</option>
                {employees.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name} · {p.email}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field
              label="Amount (₹)"
              error={errors.amount}
              hint={paise ? `${sign < 0 ? "Money out" : "Money in"}: ${formatPaise(sign * paise, { sign: true })}` : undefined}
            >
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
                autoFocus
                required
              />
            </Field>
            {(type === "opening" || type === "adjustment") && (
              <Field label="Direction">
                <Select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
                  <option value="in">{type === "opening" ? "In the bank" : "Money in"}</option>
                  <option value="out">{type === "opening" ? "Overdrawn" : "Money out"}</option>
                </Select>
              </Field>
            )}
          </div>

          {type === "expense" && (
            <Field label="Category" error={errors.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Choose…</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label={type === "expense" ? "What was it for" : type === "opening" ? "Note (optional)" : isEmployee ? "Note (optional)" : "Note"}
            error={errors.description}
            hint={type === "expense" ? "e.g. 200 poly mailers from PackCo" : undefined}
          >
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Paid by / into">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS_FINANCE.filter((m) => m.key !== "razorpay").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Reference (optional)" hint="Bank / UPI transaction id, invoice number…">
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={inputClass} />
          </Field>

          {message && <p className="text-xs text-rust">{message}</p>}
          <button type="submit" disabled={busy || !paise} className={primaryButton}>
            {busy && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </form>
      </Dialog>
    </>
  );
}
