import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { deleteImages } from "@/lib/server/cloudinary";
import { assignVariantCodes, productImageIds, toProduct } from "@/lib/server/products";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema, withDerivedPrice } from "@/lib/validation";

type Params = { params: { id: string } };

const notFound = () => NextResponse.json({ error: "Product not found" }, { status: 404 });

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();

  const row = await db.product.findUnique({ where: { id: params.id } });
  return row ? NextResponse.json({ product: toProduct(row) }) : notFound();
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();

  const existing = await db.product.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const parsed = productInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const input = withDerivedPrice(parsed.data);

  // Existing colors keep their product codes; new colors get fresh ones.
  // (Retry on the rare race where another save took a new code first.)
  const ownCodes = new Set(existing.variants.map((v) => v.code));
  let updated;
  for (let attempt = 0; ; attempt++) {
    try {
      const variants = await assignVariantCodes(input.variants, ownCodes);
      updated = await db.product.update({ where: { id: params.id }, data: { ...input, variants } });
      break;
    } catch (err) {
      const duplicateCode = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!duplicateCode || attempt >= 2) throw err;
    }
  }

  // Remove Cloudinary assets for photos the admin took off any color
  // (including every photo of a color that was deleted).
  const kept = new Set(productImageIds(parsed.data));
  await deleteImages(productImageIds(existing).filter((id) => !kept.has(id)));

  revalidateStorefront();
  return NextResponse.json({ product: toProduct(updated) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();

  const existing = await db.product.findUnique({
    where: { id: params.id },
    include: { heroSlides: true },
  });
  if (!existing) return notFound();

  // Hero slides pointing at this product are deleted with it (cascade).
  await db.product.delete({ where: { id: params.id } });
  await deleteImages([
    ...productImageIds(existing),
    ...existing.heroSlides.map((s) => s.image.publicId),
  ]);

  revalidateStorefront();
  return NextResponse.json({ ok: true, removedHeroSlides: existing.heroSlides.length });
}
