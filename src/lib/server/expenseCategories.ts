import "server-only";
import { db } from "./db";
import { EXPENSE_CATEGORIES } from "@/lib/finance";

export type CategoryNode = {
  id: string;
  name: string;
  active: boolean;
  children: { id: string; name: string; active: boolean }[];
};

/** First use: start with the standard list, which admins can then change. */
async function ensureDefaults() {
  if ((await db.expenseCategory.count()) > 0) return;
  await db.expenseCategory.createMany({
    data: EXPENSE_CATEGORIES.map((name, i) => ({ name, parentId: null, sortOrder: i })),
  });
}

/** Top-level categories: no parent (also matches rows saved without the field). */
export const topLevel = { OR: [{ parentId: null }, { parentId: { isSet: false } }] };

/** All categories with their sub-categories, in order. */
export async function expenseCategoryTree(): Promise<CategoryNode[]> {
  await ensureDefaults();
  const rows = await db.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const tops = rows.filter((r) => !r.parentId);
  return tops.map((t) => ({
    id: t.id,
    name: t.name,
    active: t.active,
    children: rows.filter((r) => r.parentId === t.id).map((c) => ({ id: c.id, name: c.name, active: c.active })),
  }));
}

/** Vendors used before, most recent first (for suggestions). */
export async function knownVendors(limit = 200) {
  const rows = await db.financeEntry.findMany({
    where: { vendor: { not: null } },
    orderBy: { at: "desc" },
    select: { vendor: true },
    take: 2000,
  });
  return Array.from(new Set(rows.map((r) => r.vendor!).filter(Boolean))).slice(0, limit);
}
