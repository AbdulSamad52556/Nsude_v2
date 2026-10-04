import "server-only";
import type { Order, Prisma } from "@prisma/client";
import { db } from "./db";
import { recordAudit, type AuditActor } from "./audit";
import { superadminEmail } from "./auth";
import { FINANCE_TYPES, formatPaise, type FinanceType } from "@/lib/finance";

// The company's money (FinanceEntry). Order money comes in automatically
// (online payments) or when an admin confirms it (COD cash received);
// refunds, expenses and employees' money are entered by admins. Every entry
// is audited; nothing is deleted — mistakes are voided.

/** Entries that count towards the balance. */
export const LIVE: Prisma.FinanceEntryWhereInput = { OR: [{ voidedAt: null }, { voidedAt: { isSet: false } }] };

const unset = (field: "moneyInAt" | "refundedAt"): Prisma.OrderWhereInput => ({
  OR: [{ [field]: null }, { [field]: { isSet: false } }],
});

/**
 * Money for an order reached the company: an online payment, or COD cash
 * an admin confirmed. Counted exactly once, however many callers race.
 * Returns false if it was already recorded.
 */
export async function recordOrderMoneyIn(
  order: Order,
  opts: {
    type: "order_payment" | "cod_received" | "order_received";
    by: AuditActor;
    method: string;
    reference?: string;
    at?: Date;
  }
) {
  const claimed = await db.order.updateMany({
    where: { id: order.id, ...unset("moneyInAt") },
    data: { moneyInAt: new Date(), ...(opts.type !== "order_payment" ? { paymentStatus: "paid" } : {}) },
  });
  if (claimed.count === 0) return false;
  const amount = order.total * 100;
  const entry = await db.financeEntry.create({
    data: {
      at: opts.at ?? new Date(),
      type: opts.type,
      amount,
      method: opts.method,
      description: `${FINANCE_TYPES[opts.type].label} · order ${order.number}`,
      orderId: order.id,
      orderNumber: order.number,
      reference: opts.reference || null,
      createdBy: opts.by.label,
    },
  });
  await auditEntry(entry, opts.by, "Money in");
  return true;
}

/** A refund for an order was paid back to the customer. */
export async function recordOrderRefund(
  order: Order,
  opts: { by: AuditActor; method: string; reference?: string; at?: Date; amountPaise?: number }
) {
  const claimed = await db.order.updateMany({
    where: { id: order.id, ...unset("refundedAt") },
    data: { refundedAt: new Date(), paymentStatus: "refunded" },
  });
  if (claimed.count === 0) return false;
  const entry = await db.financeEntry.create({
    data: {
      at: opts.at ?? new Date(),
      type: "refund",
      amount: -(opts.amountPaise ?? order.total * 100),
      method: opts.method,
      description: `Refund · order ${order.number}`,
      orderId: order.id,
      orderNumber: order.number,
      reference: opts.reference || null,
      createdBy: opts.by.label,
    },
  });
  await auditEntry(entry, opts.by, "Money out");
  return true;
}

/** History row for a finance entry (entity "finance"). */
export async function auditEntry(
  entry: {
    id: string;
    type: string;
    amount: number;
    description: string;
    at: Date;
    method: string | null;
    category: string | null;
    employeeName: string | null;
    orderNumber: string | null;
    reference: string | null;
  },
  actor: AuditActor,
  action: string
) {
  const label = FINANCE_TYPES[entry.type as FinanceType]?.label ?? entry.type;
  await recordAudit({
    actor,
    entity: "finance",
    entityId: entry.id,
    entityLabel: `${label} · ${formatPaise(entry.amount, { sign: true })}`,
    action,
    changes: [
      { field: "Type", from: "—", to: label },
      { field: "Amount", from: "—", to: formatPaise(entry.amount, { sign: true }) },
      { field: "Date", from: "—", to: entry.at.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) },
      { field: "Details", from: "—", to: entry.description },
      ...(entry.category ? [{ field: "Category", from: "—", to: entry.category }] : []),
      ...(entry.employeeName ? [{ field: "Employee", from: "—", to: entry.employeeName }] : []),
      ...(entry.orderNumber ? [{ field: "Order", from: "—", to: entry.orderNumber }] : []),
      ...(entry.method ? [{ field: "Method", from: "—", to: entry.method }] : []),
      ...(entry.reference ? [{ field: "Reference", from: "—", to: entry.reference }] : []),
    ],
  });
}

/** Sum of live entries matching `where`, in paise. */
export async function sumPaise(where: Prisma.FinanceEntryWhereInput = {}) {
  const r = await db.financeEntry.aggregate({ where: { AND: [LIVE, where] }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

/** Money still to come in: COD cash not yet confirmed, and admin-entered
    orders not paid yet (not cancelled). */
export const codToCollectWhere: Prisma.OrderWhereInput = {
  paymentMethod: { in: ["cod", "offline"] },
  status: { in: ["placed", "shipped", "delivered"] },
  ...unset("moneyInAt"),
  paymentStatus: { not: "paid" },
};

/** Cancelled orders that were paid and still need money sent back. */
export const refundsDueWhere: Prisma.OrderWhereInput = { paymentStatus: "refund_due", ...unset("refundedAt") };

/**
 * What each employee (admin user) owes the company: money they took minus
 * money they added. Negative means the company owes them.
 */
export async function employeeBalances() {
  const rows = await db.financeEntry.groupBy({
    by: ["employeeEmail", "type"],
    where: { AND: [LIVE, { type: { in: ["employee_withdrawal", "employee_deposit"] } }] },
    _sum: { amount: true },
  });
  const out = new Map<string, { taken: number; added: number; owes: number }>();
  for (const r of rows) {
    if (!r.employeeEmail) continue;
    const e = out.get(r.employeeEmail) ?? { taken: 0, added: 0, owes: 0 };
    const sum = r._sum.amount ?? 0;
    if (r.type === "employee_withdrawal") e.taken += -sum;
    else e.added += sum;
    e.owes = e.taken - e.added;
    out.set(r.employeeEmail, e);
  }
  return out;
}

/** People who can take or add company money: the super admin and admin users. */
export async function financeEmployees() {
  const users = await db.adminUser.findMany({ orderBy: { name: "asc" }, select: { email: true, name: true, active: true } });
  return [{ email: superadminEmail(), name: "Super admin", active: true }, ...users];
}

/** "2026-10-05" → that day (now, if it's today), in India time. */
export function entryDate(day?: string) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date();
  const todayIST = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  if (day === todayIST) return new Date();
  const at = new Date(`${day}T12:00:00+05:30`);
  return Number.isNaN(at.getTime()) || at.getTime() > Date.now() ? new Date() : at;
}
