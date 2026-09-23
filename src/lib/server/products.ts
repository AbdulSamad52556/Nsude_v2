import "server-only";
import type { Product as DbProduct, HeroSlide as DbHeroSlide } from "@prisma/client";
import { db } from "./db";
import type { Category, Fit, HeroSlide, Product, Size } from "@/lib/types";

// Map DB rows to the plain, serializable shapes the storefront components
// use (they're passed to client components, so no Dates or class instances).
export function toProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    description: p.description,
    story: p.story,
    images: p.images.map((i) => ({
      src: i.src,
      alt: i.alt,
      publicId: i.publicId,
      width: i.width,
      height: i.height,
    })),
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
    sizes: p.sizes as Size[],
    unavailableSizes: p.unavailableSizes as Size[],
    category: p.category as Category,
    material: p.material,
    fit: p.fit as Fit,
    weight: p.weight,
    stock: p.stock,
    featured: p.featured,
    newArrival: p.newArrival,
    measurements: p.measurements.map((m) => ({
      label: m.label,
      values: { S: m.values.S, M: m.values.M, L: m.values.L, XL: m.values.XL, XXL: m.values.XXL },
    })),
  };
}

export async function getProducts() {
  const rows = await db.product.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string) {
  const row = await db.product.findUnique({ where: { slug } });
  return row ? toProduct(row) : null;
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

export async function searchProducts(query: string, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // The catalog is small; filtering in memory keeps matching identical to
  // the old client-side search (name, fit, or any color name).
  return (await getProducts())
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.fit.toLowerCase().includes(q) ||
        p.colors.some((c) => c.name.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export function toHeroSlide(s: DbHeroSlide & { product: DbProduct }): HeroSlide {
  return {
    id: s.id,
    position: s.position,
    image: {
      src: s.image.src,
      width: s.image.width ?? 433,
      height: s.image.height ?? 576,
      publicId: s.image.publicId,
    },
    product: { id: s.product.id, name: s.product.name, slug: s.product.slug, price: s.product.price },
  };
}

export async function getHeroSlides() {
  const rows = await db.heroSlide.findMany({
    orderBy: { position: "asc" },
    include: { product: true },
  });
  return rows.map(toHeroSlide);
}
