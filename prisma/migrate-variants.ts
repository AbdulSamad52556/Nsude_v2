// One-time migration: product-level images/colors/stock/unavailableSizes →
// per-color `variants`. Run with `npm run db:migrate-variants`.
// Each old color becomes a variant that starts with the product's existing
// images, stock and sold-out sizes; the admin then swaps in the real photos
// and stock for each color. Idempotent: already-migrated products are skipped.
import { PrismaClient } from "@prisma/client";
import { generateCodes } from "../src/lib/codes";

const db = new PrismaClient();

interface LegacyImage {
  src: string;
  alt?: string;
  publicId?: string | null;
  width?: number | null;
  height?: number | null;
}

interface LegacyProduct {
  _id: { $oid: string };
  name: string;
  images?: LegacyImage[];
  colors?: { name: string; hex: string }[];
  stock?: number;
  unavailableSizes?: string[];
  variants?: { code?: string }[];
}

async function main() {
  const raw = (await db.product.findRaw()) as unknown as LegacyProduct[];
  const taken = new Set(
    raw.flatMap((p) => (p.variants ?? []).map((v) => v.code).filter((c): c is string => !!c))
  );
  let migrated = 0;

  for (const p of raw) {
    if (Array.isArray(p.variants) && p.variants.length > 0) continue;

    const colors = p.colors?.length ? p.colors : [{ name: "Default", hex: "#0a0a0a" }];
    const images = (p.images ?? []).map((i) => ({
      src: i.src,
      alt: i.alt ?? "",
      publicId: i.publicId ?? null,
      width: i.width ?? null,
      height: i.height ?? null,
    }));
    const codes = generateCodes(colors.length, taken);
    const variants = colors.map((c, i) => {
      return {
        name: c.name,
        code: codes[i],
        hex: c.hex,
        // Tag alt text with the color so it's clear which photo is which
        // once real per-color photos replace these shared placeholders.
        images: images.map((img) => ({ ...img, alt: img.alt ? `${img.alt} (${c.name})` : "" })),
        stock: p.stock ?? 0,
        unavailableSizes: p.unavailableSizes ?? [],
      };
    });

    const id = p._id.$oid;
    await db.product.update({ where: { id }, data: { variants } });
    // Drop the old product-level fields now that variants hold them.
    await db.$runCommandRaw({
      update: "Product",
      updates: [
        {
          q: { _id: { $oid: id } },
          u: { $unset: { images: "", colors: "", stock: "", unavailableSizes: "" } },
        },
      ],
    });
    migrated++;
    console.log(`${p.name}: ${variants.map((v) => v.name).join(", ")}`);
  }

  console.log(`Migrated ${migrated} product(s); ${raw.length - migrated} already had variants.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
