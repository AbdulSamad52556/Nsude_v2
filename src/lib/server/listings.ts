import "server-only";
import { unstable_cache } from "next/cache";
import type { Listing, Prisma, Product as DbProduct } from "@prisma/client";
import { db } from "./db";
import { productCategoryTree } from "./productCategories";
import { toProduct } from "./products";
import { categoryKey, priceRange, type CardData, type Product } from "@/lib/types";
import { colorKey, filtersToQuery, type Filters, type PriceBand, type SortKey } from "@/components/shop/filters";

/** Cache tag for everything read from the Listing collection. */
export const LISTINGS_TAG = "listings";
export const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Keeping listings in sync with products
// ---------------------------------------------------------------------------

function listingDocs(row: DbProduct): Prisma.ListingCreateManyInput[] {
  const product = toProduct(row);
  const swatches = product.variants.map((v) => ({ code: v.code, name: v.name, hex: v.hex }));
  return product.variants.map((v, position) => {
    const inStock = v.stock > 0;
    const range = priceRange(product, [v]);
    return {
      code: v.code,
      productId: product.id,
      position,
      productName: product.name,
      colorName: v.name,
      colorKey: colorKey(v.name),
      hex: v.hex,
      category: product.category,
      categoryKey: categoryKey(product.category),
      subcategory: product.subcategory ?? null,
      subcategoryKey: product.subcategory ? categoryKey(product.subcategory) : null,
      fit: product.fit,
      availableSizes: inStock ? product.sizes.filter((s) => !v.unavailableSizes.includes(s)) : [],
      inStock,
      priceMin: range.min,
      priceMax: range.max,
      images: v.images.slice(0, 2).map((i) => ({
        src: i.src,
        alt: i.alt,
        publicId: i.publicId ?? null,
        width: i.width ?? null,
        height: i.height ?? null,
      })),
      swatches,
      featured: product.featured,
      newArrival: product.newArrival,
      productCreatedAt: row.createdAt,
      searchText: [product.name, v.name, product.fit, product.category, product.subcategory ?? ""].join(" ").toLowerCase(),
    };
  });
}

/** Rebuild one product's listings (call after every create/update/delete). */
export async function syncProductListings(productId: string) {
  const row = await db.product.findUnique({ where: { id: productId } });
  await db.$transaction([
    db.listing.deleteMany({ where: { productId } }),
    // Blanks (custom-print tees) are never listed in the shop.
    ...(row && !row.blank ? [db.listing.createMany({ data: listingDocs(row) })] : []),
  ]);
}

/** Rebuild every listing from the products (one-off / repair). */
export async function rebuildAllListings() {
  const rows = await db.product.findMany({ where: { blank: { not: true } } });
  await db.listing.deleteMany({});
  const docs = rows.flatMap(listingDocs);
  if (docs.length) await db.listing.createMany({ data: docs });
  return docs.length;
}

// ---------------------------------------------------------------------------
// Card shape
// ---------------------------------------------------------------------------

type CardFields = Pick<
  Listing,
  "code" | "productName" | "colorName" | "fit" | "images" | "priceMin" | "priceMax" | "inStock" | "newArrival" | "swatches"
>;

const CARD_SELECT = {
  code: true,
  productName: true,
  colorName: true,
  fit: true,
  images: true,
  priceMin: true,
  priceMax: true,
  inStock: true,
  newArrival: true,
  swatches: true,
} as const;

function toCard(l: CardFields): CardData {
  return {
    code: l.code,
    name: l.productName,
    colorName: l.colorName,
    fit: l.fit,
    images: l.images.map((i) => ({ src: i.src, alt: i.alt, publicId: i.publicId, width: i.width, height: i.height })),
    price: { min: l.priceMin, max: l.priceMax },
    soldOut: !l.inStock,
    newArrival: l.newArrival,
    swatches: l.swatches.map((s) => ({ code: s.code, name: s.name, hex: s.hex })),
  };
}

// ---------------------------------------------------------------------------
// Shop: filter + sort + paginate + facet counts in one aggregation
// ---------------------------------------------------------------------------

const PRICE_MATCH: Record<PriceBand, Record<string, number>> = {
  "under-1700": { $lt: 1700 },
  "1700-2000": { $gte: 1700, $lte: 2000 },
  "above-2000": { $gt: 2000 },
};

type Facet = "category" | "subcategory" | "fits" | "sizes" | "colors" | "price";

/** MongoDB $match for the active filters, optionally ignoring one facet —
    that's how each option's count reflects all the *other* choices. */
function matchStage(f: Filters, ignore?: Facet) {
  const m: Record<string, unknown> = {};
  if (ignore !== "category" && f.category) m.categoryKey = f.category;
  // Sub-categories only narrow within their category.
  if (ignore !== "category" && ignore !== "subcategory" && f.category && f.subcategory) m.subcategoryKey = f.subcategory;
  if (ignore !== "fits" && f.fits.length) m.fit = { $in: f.fits };
  if (ignore !== "sizes" && f.sizes.length) m.availableSizes = { $in: f.sizes };
  if (ignore !== "colors" && f.colors.length) m.colorKey = { $in: f.colors };
  if (ignore !== "price" && f.price) m.priceMin = PRICE_MATCH[f.price];
  if (f.inStock) m.inStock = true;
  return { $match: m };
}

const SORT_STAGE: Record<SortKey, Record<string, 1 | -1>> = {
  featured: { featured: -1, productCreatedAt: 1, position: 1, _id: 1 },
  newest: { newArrival: -1, productCreatedAt: 1, position: 1, _id: 1 },
  "price-asc": { priceMin: 1, productCreatedAt: 1, position: 1, _id: 1 },
  "price-desc": { priceMin: -1, productCreatedAt: 1, position: 1, _id: 1 },
};

export interface ShopFacets {
  /** Counts by category key. */
  category: Record<string, number>;
  /** Counts by sub-category key, within the chosen category. */
  subcategory: Record<string, number>;
  fit: Record<string, number>;
  size: Record<string, number>;
  price: Record<string, number>;
  /** Every color in the catalog (stable order) with its current count. */
  colors: { key: string; name: string; hex: string; count: number }[];
}

export interface ShopPage {
  cards: CardData[];
  total: number;
  page: number;
  hasMore: boolean;
  facets: ShopFacets;
}

const groupCounts = (field: string) => [{ $group: { _id: field, n: { $sum: 1 } } }];
const toCounts = (rows: { _id: string; n: number }[]) =>
  Object.fromEntries(rows.filter((r) => r._id != null).map((r) => [r._id, r.n]));

async function runShopQuery(filters: Filters, page: number): Promise<ShopPage> {
  const skip = (page - 1) * PAGE_SIZE;
  const priceBandExpr = {
    $switch: {
      branches: [
        { case: { $lt: ["$priceMin", 1700] }, then: "under-1700" },
        { case: { $lte: ["$priceMin", 2000] }, then: "1700-2000" },
      ],
      default: "above-2000",
    },
  };

  const pipeline = [
      {
        $facet: {
          items: [
            matchStage(filters),
            { $sort: SORT_STAGE[filters.sort] },
            { $skip: skip },
            { $limit: PAGE_SIZE },
            { $project: { _id: 0, ...Object.fromEntries(Object.keys(CARD_SELECT).map((k) => [k, 1])) } },
          ],
          total: [matchStage(filters), { $count: "n" }],
          category: [matchStage(filters, "category"), ...groupCounts("$categoryKey")],
          subcategory: [matchStage(filters, "subcategory"), ...groupCounts("$subcategoryKey")],
          fit: [matchStage(filters, "fits"), ...groupCounts("$fit")],
          size: [matchStage(filters, "sizes"), { $unwind: "$availableSizes" }, ...groupCounts("$availableSizes")],
          price: [matchStage(filters, "price"), ...groupCounts(priceBandExpr as unknown as string)],
          colorCounts: [matchStage(filters, "colors"), ...groupCounts("$colorKey")],
          // Full color list (independent of filters) so options don't vanish.
          allColors: [
            { $sort: { productCreatedAt: 1, position: 1 } },
            { $group: { _id: "$colorKey", name: { $first: "$colorName" }, hex: { $first: "$hex" }, first: { $min: "$productCreatedAt" } } },
            { $sort: { first: 1, _id: 1 } },
          ],
        },
      },
  ];

  const [result] = (await db.listing.aggregateRaw({
    pipeline: pipeline as unknown as Prisma.InputJsonValue[],
  })) as unknown as {
    items: CardFields[];
    total: { n: number }[];
    category: { _id: string; n: number }[];
    subcategory: { _id: string; n: number }[];
    fit: { _id: string; n: number }[];
    size: { _id: string; n: number }[];
    price: { _id: string; n: number }[];
    colorCounts: { _id: string; n: number }[];
    allColors: { _id: string; name: string; hex: string }[];
  }[];

  const total = result.total[0]?.n ?? 0;
  const colorCounts = toCounts(result.colorCounts);
  return {
    cards: result.items.map(toCard),
    total,
    page,
    hasMore: skip + result.items.length < total,
    facets: {
      category: toCounts(result.category),
      subcategory: filters.category ? toCounts(result.subcategory) : {},
      fit: toCounts(result.fit),
      size: toCounts(result.size),
      price: toCounts(result.price),
      colors: result.allColors.map((c) => ({ key: c._id, name: c.name, hex: c.hex, count: colorCounts[c._id] ?? 0 })),
    },
  };
}

/** One page of shop results for these filters. Cached per filter set +
    page, and cleared whenever the catalog changes. */
export function getShopPage(filters: Filters, page = 1) {
  const safePage = Math.max(1, Math.min(500, Math.floor(page) || 1));
  const key = `${filtersToQuery(filters)}|${safePage}`;
  return unstable_cache(() => runShopQuery(filters, safePage), ["shop-page", key], {
    tags: [LISTINGS_TAG],
    revalidate: 3600,
  })();
}

// ---------------------------------------------------------------------------
// Search, featured, related, by-fit
// ---------------------------------------------------------------------------

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Colorways whose name / color / fit / category contain every search word.
 * A color word ("olive") returns those colorways; otherwise each product
 * appears once, in its default color.
 */
export function searchCards(query: string, limit = 6) {
  const words = query.toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean).slice(0, 5);
  if (words.length === 0) return Promise.resolve([] as CardData[]);

  return unstable_cache(
    async () => {
      const rows = await db.listing.findMany({
        // On MongoDB, Prisma sends `contains` through as a regex *unescaped*,
        // so escape it: visitors' text is matched literally, and crafted
        // patterns (e.g. catastrophic backtracking) can't reach the database.
        where: { AND: words.map((w) => ({ searchText: { contains: escapeRegex(w) } })) },
        orderBy: [{ featured: "desc" }, { productCreatedAt: "asc" }, { position: "asc" }],
        take: 40,
        select: { ...CARD_SELECT, position: true },
      });
      const matchesColor = (color: string) => words.some((w) => color.toLowerCase().includes(w));
      return rows
        .filter((r) => r.position === 0 || matchesColor(r.colorName))
        .slice(0, limit)
        .map(toCard);
    },
    ["search", words.join(" "), String(limit)],
    { tags: [LISTINGS_TAG], revalidate: 3600 }
  )();
}

/** Default colorway of each featured product, oldest first. */
export async function getFeaturedCards(limit = 4) {
  const rows = await db.listing.findMany({
    where: { featured: true, position: 0 },
    orderBy: { productCreatedAt: "asc" },
    take: limit,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** Newest products (one card each, default colour), "New" ones first. */
export async function getNewArrivalCards(limit = 8) {
  const rows = await db.listing.findMany({
    where: { position: 0 },
    orderBy: [{ newArrival: "desc" }, { productCreatedAt: "desc" }],
    take: limit,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** Each shown category (admin order) with how many products it has, a photo
    for its tile, and its sub-categories. */
export async function getCategoryTiles() {
  const [tree, groups] = await Promise.all([
    productCategoryTree({ activeOnly: true }),
    db.listing.groupBy({ by: ["categoryKey"], where: { position: 0 }, _count: { _all: true } }),
  ]);
  const counts = new Map(groups.map((g) => [g.categoryKey, g._count._all]));
  const tiles = await Promise.all(
    tree.map(async (c) => {
      const cover = await db.listing.findFirst({
        where: { categoryKey: c.key, position: 0 },
        orderBy: [{ featured: "desc" }, { productCreatedAt: "asc" }],
        select: { images: true, productName: true },
      });
      return {
        category: c.name,
        key: c.key,
        count: counts.get(c.key) ?? 0,
        image: cover?.images[0]?.src ?? null,
        alt: cover?.productName ?? c.name,
        subcategories: c.children.map((s) => ({ name: s.name, key: s.key })),
      };
    })
  );
  return tiles.filter((t) => t.count > 0);
}

/** Default colorway of each of these products, in the order given
    (products that no longer exist are skipped). */
export async function getCardsForProducts(productIds: string[]) {
  if (productIds.length === 0) return [] as CardData[];
  const rows = await db.listing.findMany({
    where: { productId: { in: productIds }, position: 0 },
    select: { ...CARD_SELECT, productId: true },
  });
  const byProduct = new Map(rows.map((r) => [r.productId, r]));
  return productIds.flatMap((id) => {
    const row = byProduct.get(id);
    return row ? [toCard(row)] : [];
  });
}

/** Default colorway of up to `limit` products with this fit. */
export async function getCardsByFit(fit: string, limit = 3) {
  const rows = await db.listing.findMany({
    where: { fit, position: 0 },
    orderBy: { productCreatedAt: "asc" },
    take: limit,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** "You may also like": same fit first, then same category, then anything. */
export async function getRelatedCards(product: Pick<Product, "id" | "fit" | "category" | "subcategory">, limit = 3) {
  const cards: CardData[] = [];
  const seen = new Set<string>([product.id]);
  const tiers: Prisma.ListingWhereInput[] = [
    ...(product.subcategory ? [{ subcategoryKey: categoryKey(product.subcategory) }] : []),
    { fit: product.fit },
    { category: product.category },
    {},
  ];
  for (const where of tiers) {
    if (cards.length >= limit) break;
    const rows = await db.listing.findMany({
      where: { ...where, position: 0, productId: { notIn: Array.from(seen) } },
      orderBy: { productCreatedAt: "asc" },
      take: limit - cards.length,
      select: { ...CARD_SELECT, productId: true },
    });
    for (const r of rows) {
      seen.add(r.productId);
      cards.push(toCard(r));
    }
  }
  return cards;
}
