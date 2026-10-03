"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Loader2, LogOut, MapPin, Package, Plus, ShoppingBag, User } from "lucide-react";
import { cx, formatPrice } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { formatAddress, profileSchema, type AccountData, type AddressInput } from "@/lib/account";
import { PhoneLogin } from "./PhoneLogin";
import { AddressForm } from "./AddressForm";

const CARD = "rounded-lg border border-graphite/10 bg-paper shadow-[0_1px_6px_rgba(10,10,10,0.07)]";

async function api<T>(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T & { error?: string; fields?: Record<string, string> } };
}

/** Only same-site paths are allowed as a post-login destination. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function AccountView({ initialAccount }: { initialAccount: AccountData | null }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [account, setAccount] = useState<AccountData | null>(initialAccount);
  const [tab, setTab] = useState<"orders" | "addresses" | "profile">("orders");

  function signedIn(acc: AccountData, isNew: boolean) {
    if (next) {
      router.replace(next);
      router.refresh();
      return;
    }
    setAccount(acc);
    // New customers start on Profile to add their name.
    setTab(isNew && !acc.name ? "profile" : "orders");
    router.refresh();
  }

  async function signOut() {
    await api("/api/auth/logout", "POST");
    setAccount(null);
    router.refresh();
  }

  if (!account) {
    return (
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-center px-5 pb-16 pt-24 md:min-h-0 md:pb-24 md:pt-40">
        <PhoneLogin onSignedIn={signedIn} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100svh] max-w-2xl px-5 pb-24 pt-24 md:min-h-0 md:pt-40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest2 text-ash md:text-xs">My account</p>
          <h1 className="mt-1 text-xl font-medium uppercase tracking-tighter text-ink md:text-display-md">
            {account.name ? `Hi, ${account.name.split(" ")[0]}` : "Welcome"}
          </h1>
          <p className="mt-1 text-[13px] text-graphite md:text-sm">+91 {account.phone}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex h-9 shrink-0 items-center gap-2 rounded-md border border-graphite/20 px-3 text-[11px] uppercase tracking-widest2 text-ink hover:border-ink"
        >
          <LogOut size={14} strokeWidth={1.5} /> Log out
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mt-6 grid grid-cols-3 gap-1 rounded-lg bg-bone p-1 md:mt-8">
        {(
          [
            ["orders", "Orders", Package],
            ["addresses", "Addresses", MapPin],
            ["profile", "Profile", User],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "flex h-9 items-center justify-center gap-1.5 rounded-md text-[11px] uppercase tracking-widest2 transition-colors md:h-10 md:text-xs",
              tab === key ? "bg-paper text-ink shadow-sm" : "text-graphite hover:text-ink"
            )}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 md:mt-6">
        {tab === "orders" && <OrdersTab />}
        {tab === "addresses" && <AddressesTab account={account} onChange={setAccount} />}
        {tab === "profile" && <ProfileTab account={account} onChange={setAccount} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

interface OrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: string;
  createdAt: string;
  total: number;
  subtotal: number;
  shipping: number;
  items: { code: string; name: string; color: string; size: string; price: number; quantity: number; image: string }[];
  address: AddressInput;
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-bone text-graphite",
  placed: "bg-moss/10 text-moss",
  shipped: "bg-moss/15 text-moss",
  delivered: "bg-moss text-paper",
  cancelled: "bg-bone text-ash line-through",
};

function OrdersTab() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<{ orders: OrderSummary[] }>("/api/account/orders", "GET").then((res) => {
      if (res.ok) setOrders(res.data.orders);
      else setFailed(true);
    });
  }, []);

  if (failed) return <p className="text-sm text-rust">Couldn&apos;t load your orders. Refresh to try again.</p>;
  if (!orders) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-ash" />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className={cx(CARD, "flex flex-col items-center px-5 py-10 text-center")}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss/10 text-moss">
          <ShoppingBag size={20} strokeWidth={1.5} />
        </span>
        <p className="mt-4 text-sm text-ink">No orders yet</p>
        <p className="mt-1 text-[13px] text-graphite">Orders you place will show up here.</p>
        <Link
          href="/shop"
          className="mt-5 flex h-10 items-center gap-2 rounded-md bg-moss px-6 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
        >
          Shop now <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => {
        const expanded = open === o.id;
        const count = o.items.reduce((n, i) => n + i.quantity, 0);
        return (
          <li key={o.id} className={cx(CARD, "overflow-hidden")}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : o.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 p-4 text-left md:p-5"
            >
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((i) => (
                  <div key={i.code + i.size} className="relative h-12 w-10 overflow-hidden rounded-md border-2 border-paper bg-bone">
                    {i.image && <Image src={i.image} alt="" fill sizes="40px" className="object-cover" />}
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-widest2 text-ink md:text-xs">{o.number}</p>
                <p className="mt-0.5 text-[11px] text-ash md:text-xs">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {count}{" "}
                  {count === 1 ? "item" : "items"} · {formatPrice(o.total)}
                </p>
              </div>
              <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide", STATUS_TONE[o.status])}>
                {o.status === "placed" ? "Confirmed" : ORDER_STATUS_LABEL[o.status]}
              </span>
              <ChevronDown size={16} strokeWidth={1.5} className={cx("shrink-0 text-graphite transition-transform", expanded && "rotate-180")} />
            </button>

            {expanded && (
              <div className="border-t border-graphite/10">
                <ul className="divide-y divide-graphite/10">
                  {o.items.map((i) => (
                    <li key={i.code + i.size} className="flex items-center gap-3 px-4 py-3 md:px-5">
                      <Link href={`/product/${i.code}`} className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-bone">
                        {i.image && <Image src={i.image} alt="" fill sizes="48px" className="object-cover" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] uppercase tracking-wide text-ink md:text-xs">{i.name}</p>
                        <p className="text-[11px] text-ash md:text-xs">
                          {i.color} · {i.size} · Qty {i.quantity}
                        </p>
                      </div>
                      <span className="text-[11px] text-ink md:text-xs">{formatPrice(i.price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-4 border-t border-graphite/10 p-4 text-[12px] md:grid-cols-2 md:p-5 md:text-[13px]">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest2 text-ash">Delivered to</p>
                    <p className="leading-relaxed text-graphite">{formatAddress(o.address)}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="mb-1 text-[10px] uppercase tracking-widest2 text-ash">Payment</p>
                    <p className="text-graphite">
                      {o.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"} · Subtotal {formatPrice(o.subtotal)} · Shipping{" "}
                      {o.shipping === 0 ? "Free" : formatPrice(o.shipping)}
                    </p>
                    <p className="mt-1 text-sm text-ink">Total {formatPrice(o.total)}</p>
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

function AddressesTab({ account, onChange }: { account: AccountData; onChange: (a: AccountData) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(address: AddressInput, makeDefault: boolean) {
    const res =
      editing === "new"
        ? await api<{ account: AccountData }>("/api/account/addresses", "POST", { ...address, makeDefault })
        : await api<{ account: AccountData }>(`/api/account/addresses/${editing}`, "PATCH", address);
    if (!res.ok) return res.data.error ?? "Couldn't save the address.";
    onChange(res.data.account);
    setEditing(null);
    return null;
  }

  async function act(id: string, action: "default" | "delete") {
    if (action === "delete" && !window.confirm("Remove this address?")) return;
    setBusyId(id);
    const res =
      action === "delete"
        ? await api<{ account: AccountData }>(`/api/account/addresses/${id}`, "DELETE")
        : await api<{ account: AccountData }>(`/api/account/addresses/${id}`, "PATCH", { makeDefault: true });
    setBusyId(null);
    if (res.ok) onChange(res.data.account);
  }

  return (
    <div className="flex flex-col gap-3">
      {account.addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className={cx(CARD, "p-4 md:p-5")}>
            <AddressForm initial={a} submitLabel="Save address" onSubmit={save} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <div key={a.id} className={cx(CARD, "p-4 md:p-5")}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] leading-relaxed text-ink md:text-sm">{formatAddress(a)}</p>
              {account.defaultAddressId === a.id && (
                <span className="shrink-0 rounded-full bg-moss/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-moss">Default</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-widest2">
              <button type="button" onClick={() => setEditing(a.id)} className="text-ink underline underline-offset-4">
                Edit
              </button>
              {account.defaultAddressId !== a.id && (
                <button type="button" disabled={busyId === a.id} onClick={() => act(a.id, "default")} className="text-graphite underline underline-offset-4">
                  Set as default
                </button>
              )}
              <button type="button" disabled={busyId === a.id} onClick={() => act(a.id, "delete")} className="text-rust underline underline-offset-4">
                Remove
              </button>
            </div>
          </div>
        )
      )}

      {editing === "new" ? (
        <div className={cx(CARD, "p-4 md:p-5")}>
          <p className="mb-4 text-[11px] uppercase tracking-widest2 text-ink md:text-xs">New address</p>
          <AddressForm submitLabel="Save address" onSubmit={save} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-dashed border-graphite/30 text-xs uppercase tracking-widest2 text-ink hover:border-moss md:h-11"
        >
          <Plus size={14} strokeWidth={1.5} /> Add address
        </button>
      )}
      {account.addresses.length === 0 && editing !== "new" && (
        <p className="text-center text-[13px] text-graphite">Save an address to check out faster.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function ProfileTab({ account, onChange }: { account: AccountData; onChange: (a: AccountData) => void }) {
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ name, email });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) out[String(issue.path[0])] ??= issue.message;
      setErrors(out);
      return;
    }
    setStatus("saving");
    const res = await api<{ account: AccountData }>("/api/account", "PATCH", parsed.data);
    if (!res.ok) {
      setErrors(res.data.fields ?? {});
      setStatus("idle");
      return;
    }
    onChange(res.data.account);
    setStatus("saved");
  }

  const input = "h-10 w-full rounded-md border bg-transparent px-3 text-sm text-ink focus:outline-none md:h-11";

  return (
    <form onSubmit={save} noValidate className={cx(CARD, "flex flex-col gap-4 p-4 md:p-5")}>
      {!account.name && (
        <p className="rounded-md bg-moss/10 px-3 py-2 text-[12px] text-moss">Add your name so we can address your orders properly.</p>
      )}
      <div>
        <label htmlFor="profile-name" className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
          Name
        </label>
        <input
          id="profile-name"
          value={name}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          className={cx(input, errors.name ? "border-rust" : "border-graphite/20 focus:border-ink")}
        />
        {errors.name && <p className="mt-1 text-[10px] text-rust md:text-[11px]">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="profile-email" className="mb-1.5 block text-[10px] uppercase tracking-widest text-ash md:text-[11px]">
          Email (optional)
        </label>
        <input
          id="profile-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
          className={cx(input, errors.email ? "border-rust" : "border-graphite/20 focus:border-ink")}
        />
        {errors.email && <p className="mt-1 text-[10px] text-rust md:text-[11px]">{errors.email}</p>}
      </div>
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-widest text-ash md:text-[11px]">Mobile number</p>
        <p className="flex h-10 items-center rounded-md border border-graphite/10 bg-bone/40 px-3 text-sm text-graphite md:h-11">
          +91 {account.phone}
        </p>
        <p className="mt-1 text-[10px] text-ash md:text-[11px]">You log in with this number.</p>
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="flex h-10 items-center justify-center gap-2 rounded-md bg-moss text-xs uppercase tracking-widest2 text-paper transition-[filter] hover:brightness-90 disabled:bg-graphite/40 md:h-11"
      >
        {status === "saving" && <Loader2 size={14} className="animate-spin" />}
        {status === "saved" ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}
