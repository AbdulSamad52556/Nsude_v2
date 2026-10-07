import "server-only";
import type { Collection } from "@prisma/client";
import { db } from "./db";
import type { Change } from "./audit";
import type { CollectionInput } from "@/lib/validation";

type Problem = { status: number; error: string; fields?: Record<string, string> };

/** Checks a collection before saving: free web address, real products. */
export async function checkCollection(input: CollectionInput, currentId?: string): Promise<Problem | null> {
  const taken = await db.collection.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (taken && taken.id !== currentId) {
    return { status: 409, error: "Please fix the highlighted fields", fields: { slug: "Another collection uses this address" } };
  }
  if (input.productIds.length) {
    const found = await db.product.count({ where: { id: { in: input.productIds } } });
    if (found !== input.productIds.length) {
      return { status: 400, error: "One of the picked products no longer exists. Reload and try again." };
    }
  }
  if (input.featured && !input.active) {
    return {
      status: 400,
      error: "Please fix the highlighted fields",
      fields: { featured: "Show the collection on the site to use it on the home page" },
    };
  }
  return null;
}

/** Saved fields from the form input. */
export function collectionData(input: CollectionInput) {
  return {
    name: input.name,
    slug: input.slug,
    tagline: input.tagline || null,
    description: input.description || null,
    image: input.image ? { ...input.image, alt: input.image.alt ?? "" } : null,
    productIds: input.productIds,
    active: input.active,
    featured: input.featured,
  };
}

/** Only one collection is the home page banner at a time. */
export async function clearOtherFeatured(keepId: string) {
  await db.collection.updateMany({ where: { featured: true, id: { not: keepId } }, data: { featured: false } });
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

/** Old → new, field by field, for the audit log. */
export async function collectionChanges(before: Collection | null, after: CollectionInput): Promise<Change[]> {
  const changes: Change[] = [];
  const text = (field: string, a: string | null | undefined, b: string | null | undefined) => {
    if ((a ?? "") !== (b ?? "")) changes.push({ field, from: a || "—", to: b || "—" });
  };
  text("Name", before?.name, after.name);
  text("Web address", before ? `/collections/${before.slug}` : "", `/collections/${after.slug}`);
  text("Tagline", before?.tagline, after.tagline);
  text("Description", before?.description, after.description);
  if ((before?.image?.src ?? "") !== (after.image?.src ?? "")) {
    changes.push({ field: "Banner photo", from: before?.image ? "previous photo" : "—", to: after.image ? "new photo" : "—" });
  }
  const was = before?.productIds ?? [];
  const added = after.productIds.filter((id) => !was.includes(id));
  const removed = was.filter((id) => !after.productIds.includes(id));
  if (added.length || removed.length) {
    const rows = await db.product.findMany({ where: { id: { in: [...added, ...removed] } }, select: { id: true, name: true } });
    const names = new Map(rows.map((p) => [p.id, p.name]));
    const list = (ids: string[]) => ids.map((id) => names.get(id) ?? "(deleted product)").join(", ");
    if (added.length) changes.push({ field: "Products added", from: "—", to: list(added) });
    if (removed.length) changes.push({ field: "Products removed", from: list(removed), to: "—" });
  } else if (was.join() !== after.productIds.join()) {
    changes.push({ field: "Product order", from: "previous order", to: "new order" });
  }
  if (!before || before.active !== after.active) {
    changes.push({ field: "Shown on site", from: before ? yesNo(before.active) : "—", to: yesNo(after.active) });
  }
  if (!before || before.featured !== after.featured) {
    changes.push({ field: "Home page banner", from: before ? yesNo(before.featured) : "—", to: yesNo(after.featured) });
  }
  return changes;
}
