import "server-only";
import type { Product as DbProduct, HeroSlide as DbHeroSlide } from "@prisma/client";
import { db } from "./db";
import { priceRange, type Category, type Fit, type HeroSlide, type Product, type ProductListing, type Size } from "@/lib/types";
import { CODE_PATTERN, generateCodes } from "@/lib/codes";

// Map DB rows to the plain, serializable shapes the storefront components
// use (they're passed to client components, so no Dates or class instances).
export function toProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    description: p.description,
    story: p.story,
    variants: p.variants.map((v) => ({
      name: v.name,
      code: v.code,
      hex: v.hex,
      images: v.images.map((i) => ({
        src: i.src,
        alt: i.alt,
        publicId: i.publicId,
        width: i.width,
        height: i.height,
      })),
      stock: v.stock,
      unavailableSizes: v.unavailableSizes as Size[],
      // Keep only sizes that actually have their own price.
      sizePrices: Object.fromEntries(
        Object.entries(v.sizePrices ?? {}).filter(([, price]) => typeof price === "number")
      ) as Partial<Record<Size, number>>,
    })),
    sizes: p.sizes as Size[],
    category: p.category as Category,
    material: p.material,
    fit: p.fit as Fit,
    weight: p.weight,
    featured: p.featured,
    newArrival: p.newArrival,
    measurements: p.measurements.map((m) => ({
      label: m.label,
      values: { S: m.values.S, M: m.values.M, L: m.values.L, XL: m.values.XL, XXL: m.values.XXL },
    })),
  };
}

/** Cloudinary ids of every photo across all of a product's colors. */
export function productImageIds(p: { variants: { images: { publicId?: string | null }[] }[] }) {
  return p.variants.flatMap((v) => v.images.map((i) => i.publicId)).filter((id): id is string => Boolean(id));
}

export async function getProducts() {
  const rows = await db.product.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toProduct);
}

/** The product and colorway behind a product code (case-insensitive). */
export async function getListingByCode(code: string): Promise<ProductListing | null> {
  const normalized = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) return null;
  const row = await db.product.findFirst({ where: { variants: { some: { code: normalized } } } });
  if (!row) return null;
  const product = toProduct(row);
  const variant = product.variants.find((v) => v.code === normalized);
  return variant ? { product, variant } : null;
}

/**
 * Gives each submitted color its product code. A color keeps its code only
 * if that code already belongs to this product (`ownCodes`) and isn't
 * repeated in the submission; everything else gets a fresh, store-wide
 * unique code. So codes are stable across edits and can't be forged.
 */
export async function assignVariantCodes<T extends { code?: string }>(
  variants: T[],
  ownCodes: Set<string> = new Set()
): Promise<(T & { code: string })[]> {
  const kept = new Set<string>();
  const keeps = variants.map((v) => {
    const ok = v.code && ownCodes.has(v.code) && !kept.has(v.code);
    if (ok) kept.add(v.code!);
    return ok;
  });
  const needed = keeps.filter((k) => !k).length;
  if (needed === 0) return variants.map((v) => ({ ...v, code: v.code! }));

  const all = await db.product.findMany({ select: { variants: { select: { code: true } } } });
  const taken = new Set(all.flatMap((p) => p.variants.map((v) => v.code)));
  const fresh = generateCodes(needed, taken);
  return variants.map((v, i) => ({ ...v, code: keeps[i] ? v.code! : fresh.shift()! }));
}

export async function getFeaturedProducts() {
  const rows = await db.product.findMany({
    where: { featured: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/** Same-fit products first, then same category, then anything else. */
export async function getRelatedProducts(product: Product, count = 3) {
  const others = (await getProducts()).filter((p) => p.id !== product.id);
  const score = (p: Product) =>
    (p.fit === product.fit ? 2 : 0) + (p.category === product.category ? 1 : 0);
  return others.sort((a, b) => score(b) - score(a)).slice(0, count);
}

/** Every product in every color: the shop lists one card per colorway. */
export function toListings(products: Product[]): ProductListing[] {
  return products.flatMap((product) => product.variants.map((variant) => ({ product, variant })));
}

/**
 * Search by product name, fit, or color. A color match returns just that
 * colorway (so "olive" links straight to the olive tee); a name/fit match
 * returns the product in its default color.
 */
export async function searchProducts(query: string, limit = 6): Promise<ProductListing[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // The catalog is small, so filtering in memory is simplest.
  const results: ProductListing[] = [];
  for (const product of await getProducts()) {
    const colorMatches = product.variants.filter((v) => v.name.toLowerCase().includes(q));
    if (colorMatches.length) {
      results.push(...colorMatches.map((variant) => ({ product, variant })));
    } else if (product.name.toLowerCase().includes(q) || product.fit.toLowerCase().includes(q)) {
      results.push({ product, variant: product.variants[0] });
    }
  }
  return results.slice(0, limit);
}

export function toHeroSlide(s: DbHeroSlide & { product: DbProduct }): HeroSlide {
  const product = toProduct(s.product);
  const defaultColor = product.variants[0];
  return {
    id: s.id,
    position: s.position,
    image: {
      src: s.image.src,
      width: s.image.width ?? 433,
      height: s.image.height ?? 576,
      publicId: s.image.publicId,
    },
    product: {
      id: product.id,
      name: product.name,
      // The slide links to the default color, so show that color's prices.
      priceRange: priceRange(product, defaultColor ? [defaultColor] : []),
      code: defaultColor?.code ?? "",
    },
  };
}

export async function getHeroSlides() {
  const rows = await db.heroSlide.findMany({
    orderBy: { position: "asc" },
    include: { product: true },
  });
  return rows.map(toHeroSlide);
}
