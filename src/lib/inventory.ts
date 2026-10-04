// Inventory: shared by the server and the admin Inventory pages.

export const LOW_STOCK = 15;

export const STOCK_REASONS = {
  sale: "Sold",
  order_cancelled: "Order cancelled",
  order_edited: "Order changed",
  restock: "Restock",
  returned: "Returned by customer",
  damaged: "Damaged / written off",
  correction: "Stock count correction",
  initial: "Opening stock",
  product_edit: "Edited on product page",
} as const;
export type StockReason = keyof typeof STOCK_REASONS;

/** Reasons an admin picks when adjusting stock by hand. */
export const MANUAL_STOCK_REASONS = ["restock", "returned", "damaged", "correction"] as const;
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

export const INVENTORY_TABS = [
  { href: "/admin/inventory", label: "Stock" },
  { href: "/admin/inventory/ledger", label: "Stock ledger" },
];
