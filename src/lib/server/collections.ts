import "server-only";
import { cache } from "react";
import type { Collection } from "@prisma/client";
import { db } from "./db";
import { getCardsForProducts } from "./listings";
import type { CollectionData } from "@/lib/types";

export function toCollectionData(c: Collection): CollectionData {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    tagline: c.tagline ?? "",
    description: c.description ?? "",
    image: c.image
      ? {
          src: c.image.src,
          alt: c.image.alt,
          publicId: c.image.publicId ?? null,
          width: c.image.width ?? null,
          height: c.image.height ?? null,
        }
      : null,
    productIds: c.productIds,
    active: c.active,
    featured: c.featured,
  };
}

const ORDER = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

/** Every product, for the admin picker (default colour's photo). */
export async function collectionProductOptions() {
  const rows = await db.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, variants: true },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, category: p.category, image: p.variants[0]?.images[0]?.src ?? null }));
}

/** Every collection, for the admin list. */
export function allCollections() {
  return db.collection.findMany({ orderBy: ORDER });
}

export interface CollectionTile {
  name: string;
  slug: string;
  tagline: string;
  /** Products in it that still exist. */
  count: number;
  /** The cropped banner, if one was uploaded. */
  image: { src: string; alt: string } | null;
  /** First few product photos, shown when there's no banner. */
  photos: { src: string; alt: string }[];
}

/** Banner photo, a few product photos, and how many products are live. */
async function toTiles(rows: Collection[]): Promise<CollectionTile[]> {
  const ids = Array.from(new Set(rows.flatMap((c) => c.productIds)));
  const listings = ids.length
    ? await db.listing.findMany({
        where: { productId: { in: ids }, position: 0 },
        select: { productId: true, productName: true, images: true },
      })
    : [];
  const byProduct = new Map(listings.map((l) => [l.productId, l]));
  return rows.map((c) => {
    const live = c.productIds.filter((id) => byProduct.has(id));
    const photos = live.flatMap((id) => {
      const l = byProduct.get(id)!;
      return l.images[0] ? [{ src: l.images[0].src, alt: l.productName }] : [];
    });
    return {
      name: c.name,
      slug: c.slug,
      tagline: c.tagline ?? "",
      count: live.length,
      image: c.image ? { src: c.image.src, alt: c.image.alt || c.name } : null,
      photos: photos.slice(0, 4),
    };
  });
}

/** Collections shown on the site that have at least one product. */
export async function getStoreCollections() {
  const rows = await db.collection.findMany({ where: { active: true }, orderBy: ORDER });
  return (await toTiles(rows)).filter((t) => t.count > 0);
}

/** The collection picked for the home page banner, if it's live. */
export async function getHomeCollection() {
  const row = await db.collection.findFirst({ where: { active: true, featured: true } });
  if (!row) return null;
  const [tile] = await toTiles([row]);
  return tile.count > 0 ? tile : null;
}

/** A live collection and its product cards, or null. (Cached per request:
    the page and its metadata both ask.) */
export const getCollectionPage = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const row = await db.collection.findUnique({ where: { slug } });
  if (!row || !row.active) return null;
  const [tile] = await toTiles([row]);
  return { ...tile, description: row.description ?? "", cards: await getCardsForProducts(row.productIds) };
});

/** Take a deleted product out of every collection. */
export async function removeProductFromCollections(productId: string) {
  const rows = await db.collection.findMany({ where: { productIds: { has: productId } }, select: { id: true, productIds: true } });
  for (const c of rows) {
    await db.collection.update({ where: { id: c.id }, data: { productIds: c.productIds.filter((id) => id !== productId) } });
  }
}
