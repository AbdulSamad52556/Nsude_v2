"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cx, formatPrice } from "@/lib/utils";
import { INDIAN_STATES, MAX_LINE_QUANTITY, shippingFor } from "@/lib/checkout";
import { Field, inputClass } from "./Dialog";
import { Select } from "./Select";
import { ApiError, apiFetch } from "./api";

export type CatalogColour = {
  code: string;
  product: string;
  color: string;
  stock: number;
  sizes: { size: string; price: number }[];
};

type Line = { key: number; code: string; size: string; quantity: number };

const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Order entered by an admin: customer, delivery, items, totals and payment. */
export function AdminOrderForm({ catalog }: { catalog: CatalogColour[] }) {
  const router = useRouter();
  const byCode = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog]);
  const products = useMemo(() => Array.from(new Set(catalog.map((c) => c.product))), [catalog]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState(true);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, code: "", size: "", quantity: 1 }]);
  const [shippingText, setShippingText] = useState<string | null>(null); // null = usual rule
  const [discountText, setDiscountText] = useState("");
  const [paid, setPaid] = useState<boolean | null>(null);
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priced = lines.map((l) => {
    const colour = byCode.get(l.code);
    const price = colour?.sizes.find((s) => s.size === l.size)?.price ?? 0;
    return { ...l, colour, price, total: price * l.quantity };
  });
  const subtotal = priced.reduce((n, l) => n + l.total, 0);
  const autoShipping = delivery ? shippingFor(subtotal) : 0;
  const shipping = !delivery ? 0 : shippingText === null ? autoShipping : Math.max(0, Math.floor(Number(shippingText) || 0));
  const discount = Math.max(0, Math.floor(Number(discountText) || 0));
  const total = Math.max(0, subtotal + shipping - discount);
  // Units of each colour across lines, against its stock.
  const usedByCode = priced.reduce((m, l) => m.set(l.code, (m.get(l.code) ?? 0) + l.quantity), new Map<string, number>());
  const ready = priced.every((l) => l.colour && l.price > 0) && paid !== null;

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    if (paid === null) return setMessage("Choose whether it's paid.");
    setBusy(true);
    try {
      const { id } = await apiFetch<{ id: string }>("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email,
          delivery,
          line1,
          line2,
          city,
          state,
          pincode,
          items: priced.map((l) => ({ code: l.code, size: l.size, quantity: l.quantity })),
          shipping: delivery ? shipping : 0,
          discount,
          paid,
          method,
          reference: reference || undefined,
          date,
          note: note || undefined,
        }),
      });
      router.push(`/admin/orders/${id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage((err as Error).message);
      setBusy(false);
    }
  }

  const card = "rounded-lg border border-taupe/30 p-5";
  const h2 = "mb-4 text-xs uppercase tracking-widest2";

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className={card}>
          <h2 className={h2}>Customer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName}>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required maxLength={50} />
            </Field>
            <Field label="Last name (optional)" error={errors.lastName}>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} maxLength={50} />
            </Field>
            <Field label="Mobile number" error={errors.phone} hint="Links the order to their account if they have one.">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="98765 43210"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Email (optional)" error={errors.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest2">Delivery</h2>
            <div role="radiogroup" aria-label="Delivery" className="flex rounded-md border border-taupe/50 p-0.5">
              {(
                [
                  [true, "Deliver"],
                  [false, "Handed over in person"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={delivery === value}
                  onClick={() => setDelivery(value)}
                  className={cx(
                    "h-8 rounded px-3 text-[10px] uppercase tracking-widest2",
                    delivery === value ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {delivery ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Address" error={errors.line1}>
                  <input value={line1} onChange={(e) => setLine1(e.target.value)} className={inputClass} maxLength={160} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Apartment, landmark (optional)">
                  <input value={line2} onChange={(e) => setLine2(e.target.value)} className={inputClass} maxLength={160} />
                </Field>
              </div>
              <Field label="City" error={errors.city}>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} maxLength={60} />
              </Field>
              <Field label="PIN code" error={errors.pincode}>
                <input value={pincode} onChange={(e) => setPincode(e.target.value)} inputMode="numeric" maxLength={6} className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="State" error={errors.state}>
                  <Select value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Select…</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          ) : (
            <p className="text-sm text-graphite">No shipping — the customer took it with them.</p>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Items</h2>
          <ul className="flex flex-col gap-3">
            {priced.map((l, i) => {
              const over = l.colour ? (usedByCode.get(l.code) ?? 0) > l.colour.stock : false;
              return (
                <li key={l.key} className="grid gap-3 rounded-md bg-sand/15 p-3 sm:grid-cols-[minmax(0,1fr)_96px_88px_auto] sm:items-end">
                  <Field label={`Item ${i + 1}`}>
                    <Select value={l.code} onChange={(e) => update(l.key, { code: e.target.value, size: "" })} required>
                      <option value="">Choose product & colour…</option>
                      {products.map((p) => (
                        <optgroup key={p} label={p}>
                          {catalog
                            .filter((c) => c.product === p)
                            .map((c) => (
                              <option key={c.code} value={c.code} disabled={c.stock === 0}>
                                {c.color} · {c.code} · {c.stock === 0 ? "sold out" : `${c.stock} in stock`}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Size">
                    <Select value={l.size} onChange={(e) => update(l.key, { size: e.target.value })} required disabled={!l.colour}>
                      <option value="">—</option>
                      {l.colour?.sizes.map((s) => (
                        <option key={s.size} value={s.size}>
                          {s.size}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Qty" error={over ? "Not enough" : undefined}>
                    <input
                      type="number"
                      min={1}
                      max={MAX_LINE_QUANTITY}
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
                      className={inputClass}
                    />
                  </Field>
                  <div className="flex h-11 items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm">{l.price ? formatPrice(l.total) : "—"}</span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        aria-label={`Remove item ${i + 1}`}
                        className="p-1.5 text-ash hover:text-rust"
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((l) => l.key)) + 1, code: "", size: "", quantity: 1 }])}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-md border border-taupe/50 px-3 text-[11px] uppercase tracking-widest2 text-graphite hover:border-ink hover:text-ink"
          >
            <Plus size={13} strokeWidth={1.5} /> Add item
          </button>
        </section>

        <section className={card}>
          <Field label="Internal note (optional)" hint="Only admins see this — e.g. Instagram DM, gift wrap.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={cx(inputClass, "h-auto py-2")} />
          </Field>
        </section>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:h-fit">
        <section className={card}>
          <h2 className={h2}>Total</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-graphite">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {delivery && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-graphite">
                  Shipping
                  {shippingText === null ? (
                    <button type="button" onClick={() => setShippingText(String(autoShipping))} className="ml-2 text-[11px] text-ink underline">
                      change
                    </button>
                  ) : (
                    <button type="button" onClick={() => setShippingText(null)} className="ml-2 text-[11px] text-ash underline">
                      usual
                    </button>
                  )}
                </dt>
                <dd>
                  {shippingText === null ? (
                    autoShipping === 0 ? "Free" : formatPrice(autoShipping)
                  ) : (
                    <input
                      inputMode="numeric"
                      value={shippingText}
                      onChange={(e) => setShippingText(e.target.value.replace(/\D/g, ""))}
                      className="h-8 w-24 rounded-md border border-taupe/50 bg-transparent px-2 text-right text-sm focus:border-ink focus:outline-none"
                      aria-label="Shipping (₹)"
                    />
                  )}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-graphite">Discount (₹)</dt>
              <dd>
                <input
                  inputMode="numeric"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="h-8 w-24 rounded-md border border-taupe/50 bg-transparent px-2 text-right text-sm focus:border-ink focus:outline-none"
                  aria-label="Discount (₹)"
                />
              </dd>
            </div>
            {errors.discount && <p className="text-xs text-rust">{errors.discount}</p>}
            <div className="flex justify-between border-t border-taupe/30 pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
        </section>

        <section className={card}>
          <h2 className={h2}>Payment</h2>
          <div role="radiogroup" aria-label="Paid" className="grid grid-cols-2 gap-2">
            {(
              [
                [true, "Paid now"],
                [false, "Not paid yet"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={paid === value}
                onClick={() => setPaid(value)}
                className={cx(
                  "h-11 rounded-md border text-[11px] uppercase tracking-widest2",
                  paid === value ? "border-ink bg-ink text-paper" : "border-taupe/50 text-graphite hover:border-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {paid === true && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Paid by">
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                  </Select>
                </Field>
                <Field label="Date">
                  <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Reference (optional)" hint="UPI / bank transaction id…">
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={inputClass} />
              </Field>
              <p className="text-[11px] text-ink">{formatPrice(total)} will be added to Finance.</p>
            </div>
          )}
          {paid === false && (
            <p className="mt-3 text-[11px] text-ash">
              Finance isn&apos;t changed now. Mark it paid on the order (or in Finance → to collect) when the money arrives.
            </p>
          )}
        </section>

        {message && <p className="text-xs text-rust">{message}</p>}
        <button
          type="submit"
          disabled={busy || !ready}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Create order · {formatPrice(total)}
        </button>
      </aside>
    </form>
  );
}
