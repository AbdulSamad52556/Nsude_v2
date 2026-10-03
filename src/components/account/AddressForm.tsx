"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/checkout";
import { addressSchema, type AddressInput } from "@/lib/account";

const EMPTY: AddressInput = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "" as AddressInput["state"],
  pincode: "",
};

const inputClass = (invalid: boolean) =>
  cx(
    "h-10 w-full rounded-md border bg-transparent px-3 text-sm text-ink focus:outline-none md:h-11",
    invalid ? "border-rust" : "border-graphite/20 focus:border-ink"
  );

/** Add / edit a saved address. */
export function AddressForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AddressInput;
  submitLabel: string;
  onSubmit: (address: AddressInput, makeDefault: boolean) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<AddressInput>(initial ?? EMPTY);
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AddressInput, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = addressSchema.safeParse(values);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) out[String(issue.path[0])] ??= issue.message;
      setErrors(out);
      return;
    }
    setBusy(true);
    setFormError(await onSubmit(parsed.data, makeDefault));
    setBusy(false);
  }

  const field = (key: keyof AddressInput, label: string, props: Record<string, unknown> = {}, span = false) => (
    <div className={span ? "col-span-2" : undefined}>
      <label htmlFor={`addr-${key}`} className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
        {label}
      </label>
      <input
        id={`addr-${key}`}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass(Boolean(errors[key]))}
        {...props}
      />
      {errors[key] && <p className="mt-1 text-[10px] text-rust md:text-[11px]">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-x-3 gap-y-4">
      {field("firstName", "First name", { autoComplete: "given-name" })}
      {field("lastName", "Last name", { autoComplete: "family-name" })}
      {field("line1", "Address", { autoComplete: "address-line1", placeholder: "House no., building, street" }, true)}
      {field("line2", "Apartment, area, landmark (optional)", { autoComplete: "address-line2" }, true)}
      {field("city", "City", { autoComplete: "address-level2" })}
      {field("pincode", "PIN code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6 })}
      <div className="col-span-2">
        <label htmlFor="addr-state" className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
          State
        </label>
        <div className="relative">
          <select
            id="addr-state"
            value={values.state}
            onChange={(e) => set("state", e.target.value)}
            className={cx(inputClass(Boolean(errors.state)), "cursor-pointer appearance-none pr-10", !values.state && "text-ash")}
          >
            <option value="" disabled>
              Select state
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} className="text-ink">
                {s}
              </option>
            ))}
          </select>
          <ChevronDown size={16} strokeWidth={1.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-graphite" />
        </div>
        {errors.state && <p className="mt-1 text-[10px] text-rust md:text-[11px]">{errors.state}</p>}
      </div>

      {!initial && (
        <label className="col-span-2 flex cursor-pointer items-center gap-2 text-[13px] text-graphite">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-moss" />
          Make this my default address
        </label>
      )}
      {formError && <p className="col-span-2 rounded-md border border-rust/30 p-2.5 text-xs text-rust">{formError}</p>}

      <div className="col-span-2 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 flex-1 rounded-md border border-graphite/20 text-xs uppercase tracking-widest2 text-ink md:h-11"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 flex-[2] items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 disabled:bg-graphite/40 md:h-11"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
