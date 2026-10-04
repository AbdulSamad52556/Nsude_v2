import { cx } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/checkout";

const TONE: Record<OrderStatus, string> = {
  pending_payment: "border-taupe/60 text-ash",
  placed: "border-sand bg-sand/40 text-ink",
  shipped: "border-taupe bg-taupe/20 text-ink",
  delivered: "border-moss bg-moss text-paper",
  cancelled: "border-ash/30 text-ash line-through",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  return (
    <span className={cx("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", TONE[s])}>
      {ORDER_STATUS_LABEL[s] ?? status}
    </span>
  );
}
