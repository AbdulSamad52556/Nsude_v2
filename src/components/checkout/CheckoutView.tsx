"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  ShoppingBag,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { AccountData } from "@/lib/account";
import { formatPrice, cx } from "@/lib/utils";
import { track } from "@/lib/track";
import {
  FREE_SHIPPING_THRESHOLD,
  INDIAN_STATES,
  checkoutSchema,
  shippingFor,
  type PaymentMethod,
} from "@/lib/checkout";

// ---------------------------------------------------------------------------
// Types shared with the checkout API
// ---------------------------------------------------------------------------

interface QuoteLine {
  code: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}
interface Quote {
  lines: QuoteLine[];
  issues: { code: string; size: string; message: string }[];
  subtotal: number;
  shipping: number;
  total: number;
}
interface PlacedOrder {
  number: string;
  total: number;
  paymentMethod: PaymentMethod;
  lines: QuoteLine[];
  address: string;
  email: string;
}

type FormValues = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};
const EMPTY_FORM: FormValues = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};
const FIELD_ORDER: (keyof FormValues | "paymentMethod")[] = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "line1",
  "line2",
  "city",
  "pincode",
  "state",
  "paymentMethod",
];

// The form is split into three collapsible sections, filled in order.
type SectionId = "contact" | "address" | "payment";
const SECTIONS: SectionId[] = ["contact", "address", "payment"];
const SECTION_FIELDS: Record<SectionId, string[]> = {
  contact: ["email", "phone"],
  address: ["firstName", "lastName", "line1", "line2", "city", "pincode", "state"],
  payment: ["paymentMethod"],
};
const sectionOf = (field: string) => SECTIONS.find((id) => SECTION_FIELDS[id].includes(field));

const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; hint: string; icon: LucideIcon }[] = [
  {
    value: "razorpay",
    title: "Pay online",
    hint: "UPI, cards, netbanking & wallets — secured by Razorpay",
    icon: Smartphone,
  },
  {
    value: "cod",
    title: "Cash on delivery",
    hint: "Pay in cash or UPI when your order arrives",
    icon: Banknote,
  },
];

/** A checkout step as a card: the header (with a dropdown arrow) toggles
    it open. A finished step shows a tick; a step not reached yet is locked. */
function CheckoutSection({
  id,
  title,
  icon: Icon,
  open,
  complete,
  locked,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  icon: LucideIcon;
  open: boolean;
  complete: boolean;
  /** Not reached yet (the main button unlocks it): greyed out, can't open. */
  locked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-28 overflow-hidden rounded-lg border border-graphite/10 bg-paper shadow-[0_1px_6px_rgba(10,10,10,0.07)]">
      <button
        type="button"
        onClick={onToggle}
        disabled={locked}
        aria-expanded={open}
        aria-controls={`section-${id}-body`}
        className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-not-allowed disabled:opacity-40 md:gap-4 md:p-5"
      >
        <Icon size={18} strokeWidth={1.5} className="shrink-0 text-ink" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[11px] uppercase tracking-widest2 text-ink md:text-xs">
          {title}
          {complete && !open && !locked && <Check size={14} strokeWidth={1.5} className="text-ink" aria-label="Done" />}
        </span>
        {!locked && (
          <ChevronDown
            size={18}
            strokeWidth={1.5}
            className={cx("shrink-0 text-graphite transition-transform duration-300", open && "rotate-180")}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={`section-${id}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-graphite/10 p-4 md:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** A saved detail shown as text, with an Edit link to change it. */
function SavedValue({ value, onEdit }: { value: string; onEdit: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-graphite/10 bg-bone/40 px-3 md:h-11">
      <span className="min-w-0 truncate text-sm text-ink">{value}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        title="Edit"
        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-moss transition-colors hover:bg-moss/10"
      >
        <Pencil size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Razorpay popup
// ---------------------------------------------------------------------------

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let razorpayScript: Promise<void> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  razorpayScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScript = null;
      reject(new Error("Couldn't load Razorpay"));
    };
    document.body.appendChild(script);
  });
  return razorpayScript;
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

// ---------------------------------------------------------------------------
// Form bits
// ---------------------------------------------------------------------------

const inputClass = (invalid: boolean) =>
  cx(
    "h-10 w-full rounded-md border bg-transparent px-3 text-sm text-ink focus:outline-none md:h-11",
    invalid ? "border-rust focus:border-rust" : "border-graphite/20 focus:border-ink"
  );

function FieldShell({
  id,
  label,
  error,
  span,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  span?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[10px] text-rust md:text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export function CheckoutView({ razorpayEnabled }: { razorpayEnabled: boolean }) {
  const { lines, clear, openCart } = useCart();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  // No method is pre-selected: the customer has to choose one.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set<SectionId>(["contact"]));
  // Sections the visitor has continued past. The main button continues
  // through contact and address first, then places the order.
  const [confirmed, setConfirmed] = useState<Set<SectionId>>(() => new Set<SectionId>());
  const step: SectionId = SECTIONS.find((id) => id !== "payment" && !confirmed.has(id)) ?? "payment";
  const formRef = useRef<HTMLFormElement>(null);

  // The phone Place Order bar is portalled to <body> (browser only), and
  // the page gets room at the bottom so the bar never covers the footer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Signed-in customers: pre-fill contact details and offer saved addresses.
  const [account, setAccount] = useState<AccountData | null>(null);
  const [addressChoice, setAddressChoice] = useState<string>("new");
  const [saveAddress, setSaveAddress] = useState(true);
  // Signed in: the verified number is shown as text until "Edit" is tapped.
  const [editPhone, setEditPhone] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  // Signed in with saved addresses: the chosen one shows as a summary; the
  // list only opens on "Change".
  const [showAddressList, setShowAddressList] = useState(false);
  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { account: AccountData } | null) => {
        if (!data?.account) return;
        const acc = data.account;
        setAccount(acc);
        setValues((v) => ({ ...v, email: v.email || acc.email, phone: acc.phone }));
        const preferred = acc.addresses.find((a) => a.id === acc.defaultAddressId) ?? acc.addresses[0];
        if (preferred) chooseAddress(preferred.id, acc);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Edit the chosen saved address for this order: the form opens filled in. */
  function editSavedAddress() {
    setAddressChoice("new");
    setShowAddressList(false);
    window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('[name="firstName"]')?.focus(), 0);
  }

  /** Pick a saved address (fills the address fields) or "new" (clears them). */
  function chooseAddress(id: string, acc: AccountData | null = account) {
    setAddressChoice(id);
    const saved = acc?.addresses.find((a) => a.id === id);
    setValues((v) => ({
      ...v,
      firstName: saved?.firstName ?? "",
      lastName: saved?.lastName ?? "",
      line1: saved?.line1 ?? "",
      line2: saved?.line2 ?? "",
      city: saved?.city ?? "",
      state: saved?.state ?? "",
      pincode: saved?.pincode ?? "",
    }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of ["firstName", "lastName", "line1", "line2", "city", "state", "pincode"]) delete next[k];
      return next;
    });
  }
  // Bottom bar on phones: Place Order while checking out, Continue Shopping
  // once the order is confirmed (each needs its own room at the bottom).
  const barPadding = placed
    ? "pb-[calc(68px+env(safe-area-inset-bottom))]"
    : lines.length > 0
      ? "pb-[calc(128px+env(safe-area-inset-bottom))]"
      : null;
  useEffect(() => {
    if (!barPadding) return;
    const cls = [barPadding, "md:pb-0"];
    document.body.classList.add(...cls);
    return () => document.body.classList.remove(...cls);
  }, [barPadding]);

  // Lines saved before product codes existed can't be ordered.
  const orderable = useMemo(() => lines.filter((l) => l.code), [lines]);
  const staleLines = lines.length - orderable.length;
  const items = useMemo(
    () => orderable.map((l) => ({ code: l.code!, size: l.size, quantity: l.quantity })),
    [orderable]
  );
  const itemsKey = JSON.stringify(items);

  // Price the bag on the server (current prices and stock) whenever it changes.
  useEffect(() => {
    if (placed || items.length === 0) return;
    const controller = new AbortController();
    setQuoteFailed(false);
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((q: Quote) => setQuote(q))
      .catch((err) => {
        if (err.name !== "AbortError") setQuoteFailed(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, placed]);

  // Until the server's prices arrive, show the bag's own.
  const summaryLines: QuoteLine[] =
    quote?.lines ??
    orderable.map((l) => ({
      code: l.code!,
      name: l.name,
      color: l.color,
      size: l.size,
      price: l.price,
      quantity: l.quantity,
      image: l.image,
    }));
  const subtotal = quote?.subtotal ?? summaryLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const shipping = quote?.shipping ?? shippingFor(subtotal);
  const total = subtotal + shipping;
  const issues = quote?.issues ?? [];
  const blocked = issues.length > 0 || staleLines > 0;

  // Phones: open the summary by itself when the bag has a problem, so the
  // reason Place Order is disabled is visible. Escape closes it.
  useEffect(() => {
    if (blocked) setSummaryOpen(true);
  }, [blocked]);
  useEffect(() => {
    if (!summaryOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSummaryOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [summaryOpen]);

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
  }

  /** Field errors for the whole form (first message per field). */
  function validate(): Record<string, string> {
    const parsed = checkoutSchema.safeParse({ ...values, paymentMethod, items });
    const out: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_form");
        out[key] ??= issue.message;
      }
    }
    return out;
  }
  const liveErrors = validate();
  const sectionComplete = (id: SectionId) => SECTION_FIELDS[id].every((f) => !liveErrors[f]);

  // Sections after the current step stay locked until "Continue" reaches them.
  const isLocked = (id: SectionId) => SECTIONS.indexOf(id) > SECTIONS.indexOf(step);

  function toggleSection(id: SectionId) {
    if (isLocked(id)) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** "Continue": check this section, then close it and open the next. */
  function continueFrom(id: SectionId) {
    const sectionErrors = Object.fromEntries(
      Object.entries(validate()).filter(([field]) => SECTION_FIELDS[id].includes(field))
    );
    if (Object.keys(sectionErrors).length) {
      showErrors(sectionErrors);
      return;
    }
    const next = SECTIONS[SECTIONS.indexOf(id) + 1];
    track("checkout_step", { completed: id, next: next ?? "place order" });
    setConfirmed((prev) => new Set(prev).add(id));
    setOpenSections((prev) => {
      const set = new Set(prev);
      set.delete(id);
      if (next) set.add(next);
      return set;
    });
    if (next) {
      // After this section folds away, bring the next one into view.
      window.setTimeout(() => {
        document.getElementById(`section-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 320);
    }
  }

  /** Shows errors, opening every section that has one, and focuses the
      first invalid field. */
  function showErrors(fieldErrors: Record<string, string>) {
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
    const withErrors = SECTIONS.filter((id) => SECTION_FIELDS[id].some((f) => fieldErrors[f]));
    if (withErrors.length) setOpenSections((prev) => new Set([...Array.from(prev), ...withErrors]));
    const first = FIELD_ORDER.find((k) => fieldErrors[k]);
    if (first) {
      // Wait for the render so a section that was just opened has its fields.
      window.setTimeout(() => {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }

  function finish(order: { number: string; total: number }) {
    const q = quote;
    setPlaced({
      number: order.number,
      total: order.total,
      paymentMethod: paymentMethod ?? "cod",
      lines: q?.lines ?? summaryLines,
      email: values.email.trim(),
      address: [
        `${values.firstName} ${values.lastName}`.trim(),
        values.line1,
        values.line2,
        `${values.city}, ${values.state} ${values.pincode}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    clear();
    window.scrollTo({ top: 0 });
  }

  async function payOnline(order: {
    number: string;
    total: number;
    razorpay: { keyId: string; orderId: string; amount: number; currency: string };
  }) {
    try {
      await loadRazorpay();
    } catch {
      await postJson("/api/checkout/cancel", { number: order.number, razorpayOrderId: order.razorpay.orderId });
      setFormError("Couldn't load the payment window. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    const rzp = new window.Razorpay!({
      key: order.razorpay.keyId,
      order_id: order.razorpay.orderId,
      amount: order.razorpay.amount,
      currency: order.razorpay.currency,
      name: "NSUDE",
      description: `Order ${order.number}`,
      prefill: {
        name: `${values.firstName} ${values.lastName}`.trim(),
        email: values.email.trim(),
        contact: values.phone,
      },
      theme: { color: "#0a0a0a" },
      handler: async (response: RazorpayResponse) => {
        const res = await postJson<{ number: string; total: number; error?: string }>("/api/checkout/verify", {
          number: order.number,
          ...response,
        });
        if (res.ok) {
          finish(res.data);
        } else {
          setFormError(
            `We couldn't confirm your payment. If money was taken, it's safe — contact us with order ${order.number}.`
          );
          setSubmitting(false);
        }
      },
      modal: {
        // Closed without paying: release the order (unless it was paid).
        ondismiss: async () => {
          const res = await postJson<{ number: string; status: string; total: number }>("/api/checkout/cancel", {
            number: order.number,
            razorpayOrderId: order.razorpay.orderId,
          });
          if (res.ok && res.data.status === "placed") {
            finish(res.data);
            return;
          }
          setFormError("Payment cancelled — you haven't been charged. Your bag is saved; try again when ready.");
          setSubmitting(false);
        },
      },
    });
    rzp.open();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || blocked) return;
    setFormError(null);

    const payload = {
      ...values,
      paymentMethod,
      items,
      saveAddress: Boolean(account) && addressChoice === "new" && saveAddress,
    };
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      showErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await postJson<{
        number: string;
        total: number;
        error?: string;
        fields?: Record<string, string>;
        quote?: Quote;
        razorpay?: { keyId: string; orderId: string; amount: number; currency: string };
      }>("/api/checkout", payload);

      if (!res.ok) {
        if (res.data.fields) showErrors(res.data.fields);
        if (res.data.quote) setQuote(res.data.quote);
        setFormError(res.data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (res.data.razorpay) {
        await payOnline({ ...res.data, razorpay: res.data.razorpay });
      } else {
        finish(res.data);
      }
    } catch {
      setFormError("Couldn't reach the store. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------------

  if (placed) {
    const cardClass = "rounded-lg border border-graphite/10 bg-paper shadow-[0_1px_6px_rgba(10,10,10,0.07)]";
    const itemsSubtotal = placed.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const shippingPaid = Math.max(0, placed.total - itemsSubtotal);
    const cod = placed.paymentMethod === "cod";
    return (
      <div className="mx-auto min-h-[100svh] max-w-2xl px-5 pb-24 pt-24 md:min-h-0 md:pt-40">
        <div className="flex flex-col items-center gap-3 text-center md:gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss text-paper md:h-14 md:w-14">
            <Check size={22} strokeWidth={2} />
          </span>
          <p className="text-[11px] uppercase tracking-widest2 text-ash md:text-xs">Thank you for your order</p>
          <h1 className="text-xl font-medium uppercase tracking-tighter text-ink md:text-display-md">Order Confirmed</h1>
          <span className="rounded-md bg-moss/10 px-3 py-1 text-[11px] uppercase tracking-widest2 text-moss md:text-xs">
            Order {placed.number}
          </span>
          <p className="max-w-md text-[13px] leading-relaxed text-graphite md:text-sm">
            {cod
              ? `Please keep ${formatPrice(placed.total)} ready to pay when your order arrives.`
              : "Your payment was successful."}{" "}
            We&apos;ll send shipping updates to {placed.email}.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 md:mt-10">
          {/* Items + totals */}
          <section className={cardClass}>
            <p className="border-b border-graphite/10 p-4 text-[11px] uppercase tracking-widest2 text-ink md:p-5 md:text-xs">
              Items · {placed.lines.reduce((n, l) => n + l.quantity, 0)}
            </p>
            <ul className="divide-y divide-graphite/10">
              {placed.lines.map((l) => (
                <li key={`${l.code}-${l.size}`} className="flex items-center gap-3 p-4 md:gap-4 md:px-5">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-bone">
                    {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] uppercase tracking-wide text-ink md:text-xs">{l.name}</p>
                    <p className="text-[11px] text-ash md:text-xs">
                      {l.color} · {l.size} · Qty {l.quantity}
                    </p>
                  </div>
                  <span className="text-[11px] text-ink md:text-xs">{formatPrice(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-graphite/10 p-4 text-xs md:p-5 md:text-sm">
              <div className="flex justify-between text-graphite">
                <span>Subtotal</span>
                <span>{formatPrice(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-graphite">
                <span>Shipping</span>
                <span>{shippingPaid === 0 ? "Free" : formatPrice(shippingPaid)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-graphite/10 pt-3 text-ink">
                <span className="uppercase tracking-widest2 text-ash">Total</span>
                <span className="text-base md:text-lg">{formatPrice(placed.total)}</span>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Delivery */}
            <section className={cx(cardClass, "p-4 md:p-5")}>
              <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest2 text-ink md:text-xs">
                <MapPin size={15} strokeWidth={1.5} /> Delivering to
              </p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-graphite md:text-sm">{placed.address}</p>
              <p className="mt-2 text-[11px] text-ash md:text-xs">Updates to {placed.email}</p>
            </section>

            {/* Payment */}
            <section className={cx(cardClass, "p-4 md:p-5")}>
              <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest2 text-ink md:text-xs">
                <CreditCard size={15} strokeWidth={1.5} /> Payment
              </p>
              <p className="flex items-center gap-2 text-[13px] text-ink md:text-sm">
                {cod ? <Banknote size={16} strokeWidth={1.5} /> : <Smartphone size={16} strokeWidth={1.5} />}
                {cod ? "Cash on delivery" : "Paid online"}
              </p>
              <p className="mt-1 text-[11px] text-ash md:text-xs">
                {cod ? `Keep ${formatPrice(placed.total)} ready at delivery` : `${formatPrice(placed.total)} paid`}
              </p>
            </section>
          </div>
        </div>

        {/* Larger screens: under the cards. */}
        <Link
          href="/shop"
          className="group mt-10 hidden h-14 w-full items-center justify-center gap-2 rounded-md bg-moss text-sm uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 md:flex"
        >
          Continue Shopping
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>

        {/* Phones: pinned to the bottom of the screen (portalled so it stays
            fixed inside the page's animated wrapper). */}
        {mounted &&
          createPortal(
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-graphite/10 bg-paper px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
              <Link
                href="/shop"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] active:brightness-90"
              >
                Continue Shopping
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>,
            document.body
          )}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      // Fills the screen on phones so the footer isn't on the first screen.
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-center px-5 pb-16 pt-24 text-center md:min-h-0 md:pb-24 md:pt-40">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-moss/10 text-moss md:h-20 md:w-20">
          <ShoppingBag size={26} strokeWidth={1.5} />
        </span>
        <h1 className="mt-5 text-xl font-medium uppercase tracking-tighter text-ink md:mt-6 md:text-display-md">
          Your bag is empty
        </h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-graphite md:mt-3 md:text-sm">
          There&apos;s nothing to check out yet. Find your next essential in the shop.
        </p>
        <Link
          href="/shop"
          className="group mt-7 flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 md:mt-8 md:h-12 md:text-sm"
        >
          Shop Now
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <Link
          href="/shop?sort=newest"
          className="mt-4 text-[11px] uppercase tracking-widest2 text-graphite underline decoration-graphite/30 underline-offset-4 hover:text-ink md:text-xs"
        >
          See new arrivals
        </Link>
      </div>
    );
  }

  // Phone keyboards: Enter goes to the next field in the section, and on
  // the last one continues to the next section, rather than submitting.
  function handleEnter(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, key: keyof FormValues) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const section = sectionOf(key);
    if (!section) return;
    const fields = SECTION_FIELDS[section];
    const nextField = fields.slice(fields.indexOf(key) + 1)[0];
    const nextEl = nextField && formRef.current?.querySelector<HTMLElement>(`[name="${nextField}"]`);
    if (nextEl) nextEl.focus();
    else if (section !== "payment") continueFrom(section);
  }

  const fieldProps = (key: keyof FormValues) => ({
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => handleEnter(e, key),
    // Leaving a filled-in field that's invalid shows why (the button stays
    // disabled until it's fixed); empty fields aren't flagged yet.
    onBlur: () => {
      const error = liveErrors[key];
      if (error && values[key].trim()) setErrors((prev) => ({ ...prev, [key]: error }));
    },
    enterKeyHint: "next" as const,
    id: key,
    name: key,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value),
    "aria-invalid": Boolean(errors[key]) || undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });

  const placeLabel =
    paymentMethod === "razorpay" ? `Pay ${formatPrice(total)}` : `Place Order · ${formatPrice(total)}`;

  const stepLabel: Partial<Record<SectionId, string>> = {
    contact: "Continue to Shipping",
    address: "Continue to Payment",
  };
  const continuing = step !== "payment";

  const placeButton = (className: string) => (
    <button
      type={continuing ? "button" : "submit"}
      form="checkout-form"
      // preventDefault: this tap turns the button into "Place Order", and
      // without it the browser would count the same tap as submitting.
      onClick={
        continuing
          ? (e) => {
              e.preventDefault();
              continueFrom(step);
            }
          : undefined
      }
      // Enabled once this step's fields are valid (all of them to order).
      disabled={
        submitting ||
        (continuing ? !sectionComplete(step) : blocked || !SECTIONS.every(sectionComplete))
      }
      className={cx(
        "group h-10 w-full items-center justify-center gap-2 rounded-md bg-moss md:h-14 text-xs uppercase tracking-widest2 text-paper transition-[filter,background-color] md:text-sm hover:brightness-90 disabled:cursor-not-allowed disabled:bg-graphite/40 disabled:brightness-100",
        className
      )}
    >
      {submitting ? (
        <>
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          {paymentMethod === "razorpay" ? "Waiting for payment…" : "Placing order…"}
        </>
      ) : (
        <>
          {!continuing && paymentMethod === "razorpay" && <Lock size={14} strokeWidth={1.5} />}
          {continuing ? stepLabel[step] : placeLabel}
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </>
      )}
    </button>
  );

  const errorBox = formError && (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-rust/30 p-3 text-xs text-rust md:text-sm">
      <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      <p>{formError}</p>
    </div>
  );

  const issueFor = (l: QuoteLine) => issues.find((i) => i.code === l.code && i.size === l.size);

  const itemCount = summaryLines.reduce((n, l) => n + l.quantity, 0);
  const summaryTitle = `Order Summary · ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  // Items, problems and totals — shown in the desktop card and in the
  // phone's slide-up summary.
  const summaryDetails = (
    <>
      <ul className="flex flex-col gap-4">
        {summaryLines.map((line) => {
          const issue = issueFor(line);
          return (
            <li key={`${line.code}-${line.size}`} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-bone">
                  {line.image && <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-paper">
                    {line.quantity}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ink md:text-xs">{line.name}</p>
                    <p className="text-[11px] text-ash md:text-xs">
                      {line.color} · {line.size}
                    </p>
                  </div>
                  <span className="text-[11px] text-ink md:text-xs">{formatPrice(line.price * line.quantity)}</span>
                </div>
              </div>
              {issue && <p className="text-xs text-rust">{issue.message}</p>}
            </li>
          );
        })}
        {/* Sold-out / removed items the server couldn't price. */}
        {issues
          .filter((i) => !summaryLines.some((l) => l.code === i.code && l.size === i.size))
          .map((i) => (
            <li key={`${i.code}-${i.size}-missing`} className="text-xs text-rust">
              {i.message}
            </li>
          ))}
      </ul>

      {blocked && (
        <div className="flex items-start gap-2 rounded-md border border-rust/30 p-3 text-xs text-rust">
          <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <p>
            {staleLines > 0
              ? "Some items in your bag are outdated. Please remove them and add them again."
              : "Some items can't be ordered as they are."}{" "}
            <button type="button" onClick={openCart} className="underline underline-offset-2">
              Edit bag
            </button>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-graphite/10 pt-4 text-xs md:text-sm">
        <div className="flex items-center justify-between text-graphite">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-graphite">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
        </div>
        {shipping > 0 && (
          <p className="-mt-1 text-[11px] text-ash">
            Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.
          </p>
        )}
        <div className="flex items-center justify-between border-t border-graphite/10 pt-3 text-ink">
          <span className="uppercase tracking-widest2 text-ash">Total</span>
          <span className="text-base md:text-lg">{formatPrice(total)}</span>
        </div>
        {quoteFailed && (
          <p className="text-[11px] text-ash">Couldn&apos;t refresh prices; the total is confirmed when you order.</p>
        )}
      </div>
    </>
  );

  return (
    // Phones: at least a full screen tall, so the footer never shows on the
    // first screen even when every section is closed.
    <div className="mx-auto min-h-[100svh] max-w-content px-5 pb-24 pt-28 md:min-h-0 md:px-10 md:pt-40">
      {/* Phones: centered title (back arrow is in the header); desktop: large heading. */}
      <div className="mb-8 flex items-center justify-center md:mb-14 md:justify-start">
        <h1 className="text-xl font-medium uppercase tracking-tighter text-ink md:text-display-lg">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_380px] md:gap-16">
        {/* Larger screens: summary card, sticky on the right. (Phones get
            it in the bottom bar instead.) */}
        <div className="hidden h-fit flex-col gap-6 rounded-lg border border-graphite/10 bg-paper p-6 shadow-[0_1px_6px_rgba(10,10,10,0.07)] md:sticky md:top-28 md:order-2 md:flex">
          <p className="text-xs uppercase tracking-widest2 text-ash">{summaryTitle}</p>
          {summaryDetails}
          {errorBox}
          {placeButton("flex")}
        </div>

        <form
          id="checkout-form"
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 md:order-1"
        >
          <CheckoutSection
            id="contact"
            title="Contact"
            icon={Mail}
            open={openSections.has("contact")}
            complete={sectionComplete("contact")}
            locked={isLocked("contact")}
            onToggle={() => toggleSection("contact")}
          >
            {account ? (
              <p className="mb-4 rounded-md bg-moss/10 px-3 py-2 text-[11px] text-moss md:text-xs">
                Logged in as +91 {account.phone}
              </p>
            ) : (
              <p className="mb-4 text-[12px] text-graphite md:text-[13px]">
                Have an account?{" "}
                <Link href="/account?next=/checkout" className="text-moss underline underline-offset-4">
                  Log in
                </Link>{" "}
                for faster checkout.
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <FieldShell id="email" label="Email Address" error={errors.email} span>
                {account?.email && !editEmail && values.email === account.email ? (
                  // Signed in with a saved email: no need to retype it.
                  <SavedValue
                    value={account.email}
                    onEdit={() => {
                      setEditEmail(true);
                      window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('[name="email"]')?.focus(), 0);
                    }}
                  />
                ) : (
                  <input
                    {...fieldProps("email")}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={inputClass(Boolean(errors.email))}
                  />
                )}
              </FieldShell>
              <FieldShell id="phone" label="Mobile Number" error={errors.phone} span>
                {account && !editPhone && values.phone === account.phone ? (
                  // Signed in: the number they logged in with, no need to retype it.
                  <SavedValue
                    value={`+91 ${account.phone}`}
                    onEdit={() => {
                      setEditPhone(true);
                      window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('[name="phone"]')?.focus(), 0);
                    }}
                  />
                ) : (
                  <div
                    className={cx(
                      "flex h-10 items-center overflow-hidden rounded-md border focus-within:border-ink md:h-11",
                      errors.phone ? "border-rust focus-within:border-rust" : "border-graphite/20"
                    )}
                  >
                    <span className="border-r border-graphite/15 px-3 text-sm text-ash">+91</span>
                    <input
                      {...fieldProps("phone")}
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="10-digit mobile number"
                      className="h-full w-full bg-transparent px-3 text-sm text-ink placeholder:text-ash/60 focus:outline-none"
                    />
                  </div>
                )}
              </FieldShell>
            </div>
          </CheckoutSection>

          <CheckoutSection
            id="address"
            title="Shipping Address"
            icon={MapPin}
            open={openSections.has("address")}
            complete={sectionComplete("address")}
            locked={isLocked("address")}
            onToggle={() => toggleSection("address")}
          >
            {/* Signed in with a saved address: show it, with Edit / Change. */}
            {account && !showAddressList && addressChoice !== "new" && (() => {
              const a = account.addresses.find((x) => x.id === addressChoice);
              if (!a) return null;
              return (
                <div className="flex items-start justify-between gap-3 rounded-md border border-graphite/10 bg-bone/40 p-3">
                  <p className="min-w-0 text-[13px] leading-relaxed text-ink md:text-sm">
                    {`${a.firstName} ${a.lastName}`.trim()}
                    <span className="block text-[11px] text-graphite md:text-xs">
                      {[a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(", ")}
                    </span>
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={editSavedAddress}
                      aria-label="Edit address"
                      title="Edit address"
                      className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-moss transition-colors hover:bg-moss/10"
                    >
                      <Pencil size={15} strokeWidth={1.5} />
                    </button>
                    {account.addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowAddressList(true)}
                        className="text-[11px] uppercase tracking-widest2 text-graphite underline underline-offset-4"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Typing an address while having saved ones: a way back. */}
            {account && account.addresses.length > 0 && addressChoice === "new" && !showAddressList && (
              <button
                type="button"
                onClick={() => setShowAddressList(true)}
                className="mb-4 text-[11px] uppercase tracking-widest2 text-moss underline underline-offset-4"
              >
                Use a saved address
              </button>
            )}
            {account && account.addresses.length > 0 && showAddressList && (
              <div role="radiogroup" aria-label="Saved addresses" className="mb-4 flex flex-col gap-2.5">
                {[...account.addresses.map((a) => ({ id: a.id, a })), { id: "new", a: null }].map(({ id, a }) => {
                  const on = addressChoice === id;
                  return (
                    <label
                      key={id}
                      className={cx(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                        on ? "border-moss" : "border-graphite/20 hover:border-graphite/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={on}
                        onChange={() => {
                          chooseAddress(id);
                          setShowAddressList(false);
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cx(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-moss" : "border-graphite/40"
                        )}
                      >
                        {on && <span className="h-2 w-2 rounded-full bg-moss" />}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink md:text-sm">
                        {a ? (
                          <>
                            {`${a.firstName} ${a.lastName}`.trim()}
                            <span className="block text-[11px] text-graphite md:text-xs">
                              {[a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(", ")}
                            </span>
                          </>
                        ) : (
                          "Use a new address"
                        )}
                      </span>
                      {a && account.defaultAddressId === a.id && (
                        <span className="shrink-0 rounded-full bg-moss/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-moss">Default</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <div className={cx("grid grid-cols-2 gap-x-3 gap-y-4", addressChoice !== "new" && "hidden")}>
              <FieldShell id="firstName" label="First Name" error={errors.firstName}>
                <input {...fieldProps("firstName")} autoComplete="given-name" className={inputClass(Boolean(errors.firstName))} />
              </FieldShell>
              <FieldShell id="lastName" label="Last Name" error={errors.lastName}>
                <input {...fieldProps("lastName")} autoComplete="family-name" className={inputClass(Boolean(errors.lastName))} />
              </FieldShell>
              <FieldShell id="line1" label="Address" error={errors.line1} span>
                <input
                  {...fieldProps("line1")}
                  autoComplete="address-line1"
                  placeholder="House no., building, street"
                  className={cx(inputClass(Boolean(errors.line1)), "placeholder:text-ash/60")}
                />
              </FieldShell>
              <FieldShell id="line2" label="Apartment, area, landmark" error={errors.line2} span optional>
                <input {...fieldProps("line2")} autoComplete="address-line2" className={inputClass(Boolean(errors.line2))} />
              </FieldShell>
              <FieldShell id="city" label="City" error={errors.city}>
                <input {...fieldProps("city")} autoComplete="address-level2" className={inputClass(Boolean(errors.city))} />
              </FieldShell>
              <FieldShell id="pincode" label="PIN Code" error={errors.pincode}>
                <input
                  {...fieldProps("pincode")}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={6}
                  className={inputClass(Boolean(errors.pincode))}
                />
              </FieldShell>
              <FieldShell id="state" label="State" error={errors.state} span>
                <div className="relative">
                  <select
                    {...fieldProps("state")}
                    autoComplete="address-level1"
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
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-graphite"
                  />
                </div>
              </FieldShell>
              <p className="col-span-2 -mt-1 text-[10px] text-ash md:text-[11px]">We currently deliver within India.</p>
              {account && (
                <label className="col-span-2 flex cursor-pointer items-center gap-2 text-[12px] text-graphite md:text-[13px]">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 accent-moss"
                  />
                  Save this address to my account
                </label>
              )}
            </div>
          </CheckoutSection>

          <CheckoutSection
            id="payment"
            title="Payment"
            icon={CreditCard}
            open={openSections.has("payment")}
            complete={sectionComplete("payment")}
            locked={isLocked("payment")}
            onToggle={() => toggleSection("payment")}
          >
            <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-3">
              {PAYMENT_OPTIONS.filter((o) => o.value !== "razorpay" || razorpayEnabled).map(
                ({ value, title, hint, icon: Icon }) => (
                  <label
                    key={value}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3.5 transition-colors md:gap-4 md:p-4",
                      paymentMethod === value ? "border-ink" : "border-graphite/20 hover:border-graphite/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => {
                        setPaymentMethod(value);
                        track("payment_method", { method: value });
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cx(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        paymentMethod === value ? "border-ink" : "border-graphite/40"
                      )}
                    >
                      {paymentMethod === value && <span className="h-2 w-2 rounded-full bg-ink" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] text-ink md:text-sm">{title}</span>
                      <span className="block text-[11px] text-ash md:text-xs">{hint}</span>
                    </span>
                    <Icon size={18} strokeWidth={1.5} className="text-graphite" />
                  </label>
                )
              )}
            </div>
            {errors.paymentMethod && <p className="mt-1.5 text-[11px] text-rust md:text-xs">{errors.paymentMethod}</p>}
          </CheckoutSection>

          {/* Phones: errors show at the end of the form; the button lives in
              the sticky bar below. */}
          {formError && <div className="md:hidden">{errorBox}</div>}
        </form>
      </div>

      {/* Phones: Place Order pinned to the bottom of the screen, with the
          order summary tucked above it. Portalled to
          <body> so it stays fixed inside the page's animated wrapper. */}
      {mounted &&
        createPortal(
          <div className="md:hidden">
            <AnimatePresence>
              {summaryOpen && (
                <motion.div
                  key="summary-backdrop"
                  className="fixed inset-0 z-[60] bg-ink/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSummaryOpen(false)}
                  aria-hidden
                />
              )}
            </AnimatePresence>
            <div className="fixed inset-x-0 bottom-0 z-[60] bg-paper pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(10,10,10,0.08)]">
              {/* The top edge of the summary box always peeks out above the
                  button; tapping it slides the full summary open. */}
              <button
                type="button"
                onClick={() => setSummaryOpen((o) => !o)}
                aria-expanded={summaryOpen}
                aria-controls="mobile-order-summary"
                className="flex w-full flex-col items-center border-t border-graphite/10 px-5 pb-3 pt-2"
              >
                <span aria-hidden className="mb-2 h-1 w-9 rounded-full bg-graphite/25" />
                <span className="flex w-full items-center justify-center gap-2">
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest2 text-ash">
                    {summaryTitle}
                    {/* Problems with the bag are flagged while it's closed. */}
                    {blocked && !summaryOpen && <span className="h-2 w-2 rounded-full bg-rust" aria-label="Needs attention" />}
                  </span>
                  <ChevronUp
                    size={16}
                    strokeWidth={1.5}
                    className={cx("text-ink transition-transform duration-300", summaryOpen && "rotate-180")}
                  />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {summaryOpen && (
                  <motion.div
                    key="summary-sheet"
                    id="mobile-order-summary"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-5 pb-5 pt-2">
                      {summaryDetails}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="px-5">{placeButton("flex")}</div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
