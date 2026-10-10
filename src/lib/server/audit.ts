import "server-only";
import { db } from "./db";
import { formatPrice } from "@/lib/utils";
import { priceFor, type Product } from "@/lib/types";

// Edit history ("audit log"). Every change to a customer account, product,
// hero slide or order is recorded with who made it, when, and each field's
// old → new value, so admins can see exactly what changed. Orders keep their
// own copy of prices and the delivery address, so later edits never alter
// past orders — this log is what shows how things changed over time.

export type AuditEntity = "customer" | "product" | "hero" | "order" | "admin_user" | "finance";
export interface AuditActor {
  type: "customer" | "admin" | "system";
  label: string;
}
export interface Change {
  field: string;
  from: string;
  to: string;
}

export const adminActor = (email: string): AuditActor => ({ type: "admin", label: email });
export const customerActor = (phone: string): AuditActor => ({ type: "customer", label: `+91 ${phone}` });
export const systemActor = (label: string): AuditActor => ({ type: "system", label });

/**
 * Records one history entry. Never throws: a logging problem must not break
 * the action itself (it's reported to the server log instead).
 */
export async function recordAudit(entry: {
  actor: AuditActor;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  action: string;
  changes?: Change[];
}) {
  try {
    await db.auditLog.create({
      data: {
        actorType: entry.actor.type,
        actorLabel: entry.actor.label,
        entity: entry.entity,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        action: entry.action,
        changes: (entry.changes ?? []).map((c) => ({ field: c.field, from: c.from.slice(0, 500), to: c.to.slice(0, 500) })),
      },
    });
  } catch (err) {
    console.error("Recording edit history failed", err);
  }
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
};

/** Changes between two flat records, for the given fields (label → key). */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: Record<string, keyof T>,
  format: (v: unknown) => string = show
): Change[] {
  const out: Change[] = [];
  for (const [label, key] of Object.entries(fields)) {
    const from = format(before[key]);
    const to = format(after[key]);
    if (from !== to) out.push({ field: label, from, to });
  }
  return out;
}

type AddressLike = {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

export function describeAddress(a: AddressLike) {
  return [`${a.firstName} ${a.lastName}`.trim(), a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`]
    .filter(Boolean)
    .join(", ");
}

export function addressChanges(before: AddressLike, after: AddressLike): Change[] {
  return diffFields(before, after, {
    "First name": "firstName",
    "Last name": "lastName",
    Address: "line1",
    "Apartment / area": "line2",
    City: "city",
    State: "state",
    "PIN code": "pincode",
  });
}

const price = (v: unknown) => (typeof v === "number" ? formatPrice(v) : "—");

/**
 * Everything that changed on a product, color by color: details, flags,
 * per-size prices, stock, sold-out sizes and photos, plus colors added or
 * removed.
 */
export function productChanges(before: Product, after: Product): Change[] {
  const out: Change[] = [
    ...diffFields(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, {
      Name: "name",
      Description: "description",
      Story: "story",
      Category: "category",
      "Sub-category": "subcategory",
      Fit: "fit",
      Material: "material",
      Weight: "weight",
      Sizes: "sizes",
      "Featured on home page": "featured",
      "New arrival": "newArrival",
      "Blank for custom designs": "blank",
    }),
    ...diffFields(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      { "Compare-at price": "compareAtPrice", "From price": "price" },
      price
    ),
  ];
  if (JSON.stringify(before.measurements) !== JSON.stringify(after.measurements)) {
    out.push({ field: "Measurements", from: "previous table", to: "updated table" });
  }

  const oldByCode = new Map(before.variants.map((v) => [v.code, v]));
  const newByCode = new Map(after.variants.map((v) => [v.code, v]));

  for (const v of after.variants) {
    const old = oldByCode.get(v.code);
    const tag = `${v.name} (${v.code})`;
    if (!old) {
      out.push({ field: "Color added", from: "—", to: `${tag} · stock ${v.stock}` });
      continue;
    }
    if (old.name !== v.name) out.push({ field: `Color name · ${v.code}`, from: old.name, to: v.name });
    if (old.hex !== v.hex) out.push({ field: `Swatch · ${tag}`, from: old.hex, to: v.hex });
    if (old.stock !== v.stock) out.push({ field: `Stock · ${tag}`, from: String(old.stock), to: String(v.stock) });
    const oldSold = [...old.unavailableSizes].sort().join(", ") || "—";
    const newSold = [...v.unavailableSizes].sort().join(", ") || "—";
    if (oldSold !== newSold) out.push({ field: `Sold-out sizes · ${tag}`, from: oldSold, to: newSold });
    // Compare the price customers actually pay (a size without its own
    // price uses the product's base price), only for sizes it's made in.
    const sizes = Array.from(new Set([...before.sizes, ...after.sizes]));
    for (const size of sizes) {
      const from = before.sizes.includes(size) ? priceFor(before, old, size) : undefined;
      const to = after.sizes.includes(size) ? priceFor(after, v, size) : undefined;
      if (from !== to) out.push({ field: `Price · ${tag} · ${size}`, from: price(from), to: price(to) });
    }
    const oldPhotos = old.images.map((i) => i.src).join("|");
    const newPhotos = v.images.map((i) => i.src).join("|");
    if (oldPhotos !== newPhotos) {
      out.push({ field: `Photos · ${tag}`, from: `${old.images.length} photo(s)`, to: `${v.images.length} photo(s), updated` });
    }
  }
  for (const v of before.variants) {
    if (!newByCode.has(v.code)) out.push({ field: "Color removed", from: `${v.name} (${v.code})`, to: "—" });
  }
  return out;
}

/** A product's full starting state, for "Product created". */
export function productSnapshot(p: Product): Change[] {
  const changes: Change[] = [
    { field: "Name", from: "—", to: p.name },
    { field: "Category / fit", from: "—", to: `${p.category}${p.subcategory ? ` › ${p.subcategory}` : ""} · ${p.fit}` },
    { field: "Sizes", from: "—", to: p.sizes.join(", ") },
  ];
  for (const v of p.variants) {
    const prices = p.sizes.map((s) => `${s} ${price(priceFor(p, v, s))}`).join(", ");
    changes.push({ field: `Color · ${v.name} (${v.code})`, from: "—", to: `stock ${v.stock} · ${prices}` });
  }
  return changes;
}
