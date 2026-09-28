"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";
import { apiFetch, ApiError } from "./api";

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

/** Buttons for the status changes this order allows. */
export function OrderStatusControl({ id, status, next }: { id: string; status: OrderStatus; next: OrderStatus[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(to: OrderStatus) {
    if (
      to === "cancelled" &&
      !window.confirm(
        "Cancel this order? Its items go back into stock." +
          (status !== "pending_payment" ? " Refund any online payment from the Razorpay dashboard." : "")
      )
    ) {
      return;
    }
    setBusy(to);
    setError(null);
    try {
      await apiFetch(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: to }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the order");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{ORDER_STATUS_LABEL[status]}</p>
      {status === "pending_payment" && (
        <p className="text-xs text-ash">
          Waiting for the customer to pay online. Unpaid orders are cancelled automatically after 30 minutes.
        </p>
      )}
      {next.length === 0 && <p className="text-xs text-ash">No further changes.</p>}
      {next.map((to) => (
        <button
          key={to}
          type="button"
          onClick={() => change(to)}
          disabled={busy !== null}
          className={cx(
            "flex h-10 items-center justify-center gap-2 text-xs uppercase tracking-widest2 disabled:opacity-50",
            to === "cancelled"
              ? "border border-graphite/20 text-rust hover:border-rust"
              : "bg-ink text-bone hover:bg-graphite"
          )}
        >
          {busy === to && <Loader2 size={14} className="animate-spin" />}
          {ACTION_LABEL[to] ?? ORDER_STATUS_LABEL[to]}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-xs text-rust">
          {error}
        </p>
      )}
    </div>
  );
}
