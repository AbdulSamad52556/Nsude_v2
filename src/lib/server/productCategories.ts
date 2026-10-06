import "server-only";
import { db } from "./db";
import { CATEGORIES, categoryKey, type CategoryTreeNode } from "@/lib/types";

/** Top-level categories: no parent (also matches rows saved without the field). */
export const topLevelCategory = { OR: [{ parentId: null }, { parentId: { isSet: false } }] };

let ready: Promise<void> | null = null;

/**
 * First use: start with the categories products already use (plus the
 * standard ones), and give older shop listings their category keys.
 */
function ensureReady() {
  ready ??= (async () => {
    if ((await db.productCategory.count()) === 0) {
      const used = (await db.product.findMany({ select: { category: true }, distinct: ["category"] })).map((p) => p.category);
      const names = Array.from(new Set([...CATEGORIES, ...used].map((n) => n.trim()).filter(Boolean)));
      await db.productCategory.createMany({ data: names.map((name, i) => ({ name, parentId: null, sortOrder: i })) });
    }
    // Listings saved before categories had URL keys.
    const missing = await db.listing.findMany({
      where: { OR: [{ categoryKey: null }, { categoryKey: { isSet: false } }] },
      select: { category: true },
      distinct: ["category"],
    });
    for (const { category } of missing) {
      await db.listing.updateMany({
        where: { category, OR: [{ categoryKey: null }, { categoryKey: { isSet: false } }] },
        data: { categoryKey: categoryKey(category) },
      });
    }
  })().catch((err) => {
    ready = null; // try again next time
    throw err;
  });
  return ready;
}

/** Categories with their sub-categories, in the admin's order. */
export async function productCategoryTree({ activeOnly = false } = {}): Promise<CategoryTreeNode[]> {
  await ensureReady();
  const rows = await db.productCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows
    .filter((r) => !r.parentId && (!activeOnly || r.active))
    .map((t) => ({
      id: t.id,
      name: t.name,
      key: categoryKey(t.name),
      active: t.active,
      children: rows
        .filter((r) => r.parentId === t.id && (!activeOnly || r.active))
        .map((c) => ({ id: c.id, name: c.name, key: categoryKey(c.name), active: c.active })),
    }));
}

/**
 * Checks a product's category / sub-category against the admin's list.
 * `current` lets an existing product keep a category that's since been
 * hidden. Returns an error message, or null when fine.
 */
export async function checkProductCategory(
  category: string,
  subcategory: string | null | undefined,
  current?: { category: string; subcategory?: string | null }
) {
  const tree = await productCategoryTree();
  const cat = tree.find((c) => c.name === category);
  if (!cat || (!cat.active && current?.category !== category)) return { field: "category", message: "Choose a category" };
  if (!subcategory) return null;
  const sub = cat.children.find((s) => s.name === subcategory);
  if (!sub || (!sub.active && current?.subcategory !== subcategory)) {
    return { field: "subcategory", message: "Choose a sub-category of this category" };
  }
  return null;
}
