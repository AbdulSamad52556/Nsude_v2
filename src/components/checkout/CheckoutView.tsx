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
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { BackButton } from "@/components/ui/BackButton";
import { formatPrice, cx } from "@/lib/utils";
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

/** A checkout step as a card: the header toggles it open. A finished,
    closed step shows a tick and Edit. */
function CheckoutSection({
  id,
  title,
  icon: Icon,
  open,
  complete,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  icon: LucideIcon;
  open: boolean;
  complete: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-28 border border-graphite/15">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-${id}-body`}
        className="flex w-full items-center gap-3 p-4 text-left md:gap-4 md:p-5"
      >
        <Icon size={18} strokeWidth={1.5} className="shrink-0 text-ink" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs uppercase tracking-widest2 text-ink">
          {title}
          {complete && !open && <Check size={14} strokeWidth={1.5} className="text-ink" aria-label="Done" />}
        </span>
        {open ? (
          <ChevronUp size={18} strokeWidth={1.5} className="shrink-0 text-graphite" />
        ) : complete ? (
          <span className="shrink-0 text-[11px] uppercase tracking-widest2 text-graphite underline underline-offset-4">
            Edit
          </span>
        ) : (
          <ChevronDown size={18} strokeWidth={1.5} className="shrink-0 text-graphite" />
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
    "h-11 w-full border bg-transparent px-3 text-base text-ink focus:outline-none md:text-sm",
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
      <label htmlFor={id} className="mb-1.5 block text-[11px] uppercase tracking-widest text-ash">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-rust">
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(razorpayEnabled ? "razorpay" : "cod");
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
  const showBar = !placed && lines.length > 0;
  useEffect(() => {
    if (!showBar) return;
    const cls = ["pb-[calc(128px+env(safe-area-inset-bottom))]", "md:pb-0"];
    document.body.classList.add(...cls);
    return () => document.body.classList.remove(...cls);
  }, [showBar]);

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

  function toggleSection(id: SectionId) {
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
      paymentMethod,
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

    const payload = { ...values, paymentMethod, items };
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
    return (
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-32 md:pt-40">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ink">
            <Check size={22} strokeWidth={1.5} />
          </span>
          <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">Order Confirmed</h1>
          <p className="max-w-md text-sm text-graphite">
            Thank you! Your order <span className="font-medium text-ink">{placed.number}</span> has been placed.
            {placed.paymentMethod === "cod"
              ? ` Please keep ${formatPrice(placed.total)} ready to pay on delivery.`
              : " Your payment was successful."}{" "}
            We&apos;ll contact you at {placed.email} with shipping updates.
          </p>
        </div>

        <div className="mt-10 border border-graphite/15">
          <ul className="divide-y divide-graphite/10">
            {placed.lines.map((l) => (
              <li key={`${l.code}-${l.size}`} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-bone">
                  {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-ink">{l.name}</p>
                  <p className="text-xs text-ash">
                    {l.color} · {l.size} · Qty {l.quantity}
                  </p>
                </div>
                <span className="text-xs text-ink">{formatPrice(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-6 border-t border-graphite/10 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-widest2 text-ash">Shipping to</p>
              <p className="whitespace-pre-line text-graphite">{placed.address}</p>
            </div>
            <div className="sm:text-right">
              <p className="mb-1 text-[11px] uppercase tracking-widest2 text-ash">
                {placed.paymentMethod === "cod" ? "Pay on delivery" : "Paid online"}
              </p>
              <p className="text-lg text-ink">{formatPrice(placed.total)}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 border-b border-ink pb-1 text-sm uppercase tracking-widest2 text-ink"
          >
            Continue Shopping
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-6 px-5 pb-24 pt-32 text-center md:pt-40">
        <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">Nothing to Checkout</h1>
        <p className="text-sm text-graphite">Your bag is empty.</p>
        <Link
          href="/shop"
          className="group mt-2 inline-flex items-center gap-2 border-b border-ink pb-1 text-sm uppercase tracking-widest2 text-ink"
        >
          Shop Now
          <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
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
      onClick={continuing ? () => continueFrom(step) : undefined}
      // Enabled once this step's fields are valid (all of them to order).
      disabled={
        submitting ||
        (continuing ? !sectionComplete(step) : blocked || !SECTIONS.every(sectionComplete))
      }
      className={cx(
        "group h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite disabled:cursor-not-allowed disabled:bg-graphite/40",
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
    <div role="alert" className="flex items-start gap-2 border border-rust/30 p-3 text-sm text-rust">
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
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-bone">
                    {line.quantity}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink">{line.name}</p>
                    <p className="text-xs text-ash">
                      {line.color} · {line.size}
                    </p>
                  </div>
                  <span className="text-xs text-ink">{formatPrice(line.price * line.quantity)}</span>
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
        <div className="flex items-start gap-2 border border-rust/30 p-3 text-xs text-rust">
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

      <div className="flex flex-col gap-3 border-t border-graphite/10 pt-4 text-sm">
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
          <span className="text-lg">{formatPrice(total)}</span>
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
      {/* Phones: centered title with a back arrow; desktop: large heading. */}
      <div className="relative mb-8 flex items-center justify-center md:mb-14 md:justify-start">
        <BackButton className="absolute left-0 -ml-3 md:hidden" />
        <h1 className="text-2xl font-medium uppercase tracking-tighter text-ink md:text-display-lg">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_380px] md:gap-16">
        {/* Larger screens: summary card, sticky on the right. (Phones get
            it in the bottom bar instead.) */}
        <div className="hidden h-fit flex-col gap-6 border border-graphite/15 p-6 md:sticky md:top-28 md:order-2 md:flex">
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
            onToggle={() => toggleSection("contact")}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <FieldShell id="email" label="Email Address" error={errors.email} span>
                <input
                  {...fieldProps("email")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={inputClass(Boolean(errors.email))}
                />
              </FieldShell>
              <FieldShell id="phone" label="Mobile Number" error={errors.phone} span>
                <div
                  className={cx(
                    "flex h-11 items-center border focus-within:border-ink",
                    errors.phone ? "border-rust focus-within:border-rust" : "border-graphite/20"
                  )}
                >
                  <span className="border-r border-graphite/15 px-3 text-base text-ash md:text-sm">+91</span>
                  <input
                    {...fieldProps("phone")}
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="10-digit mobile number"
                    className="h-full w-full bg-transparent px-3 text-base text-ink placeholder:text-ash/60 focus:outline-none md:text-sm"
                  />
                </div>
              </FieldShell>
            </div>
          </CheckoutSection>

          <CheckoutSection
            id="address"
            title="Shipping Address"
            icon={MapPin}
            open={openSections.has("address")}
            complete={sectionComplete("address")}
            onToggle={() => toggleSection("address")}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
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
              <p className="col-span-2 -mt-1 text-[11px] text-ash">We currently deliver within India.</p>
            </div>
          </CheckoutSection>

          <CheckoutSection
            id="payment"
            title="Payment"
            icon={CreditCard}
            open={openSections.has("payment")}
            complete={sectionComplete("payment")}
            onToggle={() => toggleSection("payment")}
          >
            <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-3">
              {PAYMENT_OPTIONS.filter((o) => o.value !== "razorpay" || razorpayEnabled).map(
                ({ value, title, hint, icon: Icon }) => (
                  <label
                    key={value}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 border p-3.5 transition-colors md:gap-4 md:p-4",
                      paymentMethod === value ? "border-ink" : "border-graphite/20 hover:border-graphite/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
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
                      <span className="block text-sm text-ink">{title}</span>
                      <span className="block text-xs text-ash">{hint}</span>
                    </span>
                    <Icon size={18} strokeWidth={1.5} className="text-graphite" />
                  </label>
                )
              )}
            </div>
            {errors.paymentMethod && <p className="mt-1.5 text-xs text-rust">{errors.paymentMethod}</p>}
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
                  <span className="flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash">
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
