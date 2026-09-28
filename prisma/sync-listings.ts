// Rebuilds the Listing collection (the shop's read model) from all products.
// The admin keeps listings in sync automatically; run this after importing
// data directly into MongoDB, or to repair: `npm run db:sync-listings`.
import { PrismaClient, type Product } from "@prisma/client";

const db = new PrismaClient();

const colorKey = (v: string) => v.toLowerCase().replace(/\s+/g, "-");

function docs(p: Product) {
  const sizes = p.sizes;
  const swatches = p.variants.map((v) => ({ code: v.code, name: v.name, hex: v.hex }));
  return p.variants.map((v, position) => {
    const prices = sizes.map((s) => (v.sizePrices as Record<string, number | null> | null)?.[s] ?? p.price);
    const inStock = v.stock > 0;
    return {
      code: v.code,
      productId: p.id,
      position,
      productName: p.name,
      colorName: v.name,
      colorKey: colorKey(v.name),
      hex: v.hex,
      category: p.category,
      fit: p.fit,
      availableSizes: inStock ? sizes.filter((s) => !v.unavailableSizes.includes(s)) : [],
      inStock,
      priceMin: prices.length ? Math.min(...prices) : p.price,
      priceMax: prices.length ? Math.max(...prices) : p.price,
      images: v.images.slice(0, 2),
      swatches,
      featured: p.featured,
      newArrival: p.newArrival,
      productCreatedAt: p.createdAt,
      searchText: [p.name, v.name, p.fit, p.category].join(" ").toLowerCase(),
    };
  });
}

async function main() {
  const products = await db.product.findMany();
  await db.listing.deleteMany({});
  const all = products.flatMap(docs);
  if (all.length) await db.listing.createMany({ data: all });
  console.log(`Listings rebuilt: ${all.length} colorways from ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
