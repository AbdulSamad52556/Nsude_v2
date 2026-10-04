// Finance: shared by the server and the admin Finance pages.
// Money is kept in paise (₹1 = 100) so amounts like ₹249.50 stay exact.

export const FINANCE_TYPES = {
  opening: { label: "Opening balance", sign: 0 },
  order_payment: { label: "Online payment", sign: 1 },
  cod_received: { label: "COD cash received", sign: 1 },
  order_received: { label: "Order payment received", sign: 1 },
  refund: { label: "Refund", sign: -1 },
  expense: { label: "Expense", sign: -1 },
  employee_withdrawal: { label: "Taken by employee", sign: -1 },
  employee_deposit: { label: "Added by employee", sign: 1 },
  income: { label: "Other income", sign: 1 },
  adjustment: { label: "Correction", sign: 0 },
} as const;
export type FinanceType = keyof typeof FINANCE_TYPES;

/** Entries an admin adds by hand (orders and refunds come from Orders). */
export const MANUAL_TYPES = ["expense", "employee_withdrawal", "employee_deposit", "income", "adjustment"] as const;
export type ManualType = (typeof MANUAL_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "Production",
  "Fabric & materials",
  "Packaging",
  "Shipping & courier",
  "Marketing",
  "Photography",
  "Salaries",
  "Rent & utilities",
  "Software & website",
  "Payment fees",
  "Taxes & fees",
  "Travel",
  "Other",
] as const;

export const PAYMENT_METHODS_FINANCE = [
  { key: "bank", label: "Bank transfer" },
  { key: "upi", label: "UPI" },
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "razorpay", label: "Razorpay" },
] as const;

/** 123450 → "₹1,234.50"; whole rupees without decimals. */
export function formatPaise(paise: number, { sign = false } = {}) {
  const rupees = Math.abs(paise) / 100;
  const text = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  if (paise < 0) return `−${text}`;
  return sign && paise > 0 ? `+${text}` : text;
}

/** "1,234.5" → 123450 paise; null if not a valid amount. */
export function parseRupees(input: string) {
  const clean = input.replace(/[₹,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const FINANCE_TABS = [
  { href: "/admin/finance", label: "Overview" },
  { href: "/admin/finance/ledger", label: "Ledger" },
  { href: "/admin/finance/employees", label: "Employees" },
];
