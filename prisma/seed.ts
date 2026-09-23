// Seeds MongoDB with the initial catalog and hero carousel.
// Run with `npm run db:seed`. Safe to re-run: products whose slug already
// exists are skipped, and hero slides are only created if there are none.
import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { heroSeed, products } from "./seed-data";

const db = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function uploadCutout(file: string) {
  const buffer = await readFile(path.join(process.cwd(), file));
  return new Promise<{ src: string; publicId: string; width: number; height: number }>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "nsude/hero", resource_type: "image" }, (err, res) => {
          if (err || !res) return reject(err ?? new Error("Upload failed"));
          resolve({ src: res.secure_url, publicId: res.public_id, width: res.width, height: res.height });
        })
        .end(buffer);
    }
  );
}

async function seedProducts() {
  let created = 0;
  // Stagger createdAt so the storefront's "oldest first" order matches the
  // original catalog order.
  const base = Date.now() - products.length * 1000;
  for (const [i, p] of products.entries()) {
    const exists = await db.product.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    const { id: _ignored, ...data } = p;
    await db.product.create({
      data: {
        ...data,
        unavailableSizes: data.unavailableSizes ?? [],
        compareAtPrice: data.compareAtPrice ?? null,
        createdAt: new Date(base + i * 1000),
      },
    });
    created++;
  }
  console.log(`Products: ${created} created, ${products.length - created} already existed`);
}

async function seedHero() {
  if ((await db.heroSlide.count()) > 0) {
    console.log("Hero slides: already present, skipped");
    return;
  }
  for (const [position, slide] of heroSeed.entries()) {
    const product = await db.product.findUnique({ where: { slug: slide.slug } });
    if (!product) {
      console.warn(`Hero slide ${position + 1}: product "${slide.slug}" not found, skipped`);
      continue;
    }
    const image = await uploadCutout(slide.file);
    await db.heroSlide.create({
      data: { position, productId: product.id, image: { ...image, alt: `${product.name} product shot` } },
    });
    console.log(`Hero slide ${position + 1}: ${product.name} → ${image.src}`);
  }
}

async function main() {
  await seedProducts();
  await seedHero();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
