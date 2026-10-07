"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cx } from "@/lib/utils";
import {
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
import { BillPicker, type Attachment } from "./FinanceAttachments";

type Employee = { email: string; name: string };
export type CategoryOption = { id: string; name: string; active: boolean; children: { id: string; name: string; active: boolean }[] };
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
  categories = [],
  vendors = [],
  initialType = "expense",
  label,
  variant = "primary",
}: {
  employees: Employee[];
  /** Expense categories and their sub-categories (Finance → Categories). */
  categories?: CategoryOption[];
  /** Vendors used before, suggested while typing. */
  vendors?: string[];
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
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [vendor, setVendor] = useState("");
  const [bills, setBills] = useState<Attachment[]>([]);
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const paise = parseRupees(amount);
  const sign = type === "opening" || type === "adjustment" ? (direction === "out" ? -1 : 1) : FINANCE_TYPES[type].sign;
  const isEmployee = type === "employee_withdrawal" || type === "employee_deposit";
  const hasVendor = type === "expense" || type === "income";
  const shownCategories = categories.filter((c) => c.active);
  const subOptions = shownCategories.find((c) => c.id === categoryId)?.children.filter((c) => c.active) ?? [];

  function reset() {
    setAmount("");
    setDescription("");
    setReference("");
    setCategoryId("");
    setSubcategoryId("");
    setVendor("");
    setBills([]);
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
          categoryId: type === "expense" ? categoryId : undefined,
          subcategoryId: type === "expense" && subcategoryId ? subcategoryId : undefined,
          vendor: hasVendor && vendor ? vendor : undefined,
          attachments: bills,
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
            ? "flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite"
            : "flex h-10 items-center gap-2 rounded-md border border-taupe/50 px-4 text-[11px] uppercase tracking-widest2 text-graphite hover:border-ink hover:text-ink"
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
                    type === t ? "border-ink bg-ink text-paper" : "border-taupe/50 text-graphite hover:border-ink"
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
            <div className={cx("grid gap-3", subOptions.length > 0 && "grid-cols-2")}>
              <Field label="Category" error={errors.categoryId}>
                <Select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId("");
                  }}
                  required
                >
                  <option value="">Choose…</option>
                  {shownCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {subOptions.length > 0 && (
                <Field label="Sub-category (optional)" error={errors.subcategoryId}>
                  <Select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
                    <option value="">—</option>
                    {subOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}

          {hasVendor && (
            <Field
              label={type === "expense" ? "Paid to (vendor)" : "Received from"}
              hint={type === "expense" ? "Shop, supplier or person — e.g. PackCo" : undefined}
            >
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                list="finance-vendors"
                maxLength={100}
                autoComplete="off"
                className={inputClass}
              />
              <datalist id="finance-vendors">
                {vendors.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </Field>
          )}

          <Field
            label={type === "expense" ? "What was it for" : type === "opening" ? "Note (optional)" : isEmployee ? "Note (optional)" : "Note"}
            error={errors.description}
            hint={type === "expense" ? "e.g. 200 poly mailers" : undefined}
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

          {type !== "opening" && <BillPicker value={bills} onChange={setBills} />}

          {message && <p className="text-xs text-rust">{message}</p>}
          <button type="submit" disabled={busy || !paise} className={primaryButton}>
            {busy && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </form>
      </Dialog>
    </>
  );
}
