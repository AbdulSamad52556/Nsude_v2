import { cx } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";

const TONE: Record<OrderStatus, string> = {
  pending_payment: "border-graphite/30 text-ash",
  placed: "border-rust/40 text-rust",
  shipped: "border-ink/40 text-ink",
  delivered: "border-ink bg-ink text-paper",
  cancelled: "border-graphite/20 text-ash line-through",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  return (
    <span className={cx("inline-block whitespace-nowrap border px-2 py-0.5 text-[10px] uppercase tracking-wide", TONE[s])}>
      {ORDER_STATUS_LABEL[s] ?? status}
    </span>
  );
}
