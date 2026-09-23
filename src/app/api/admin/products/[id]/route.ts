import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { deleteImages } from "@/lib/server/cloudinary";
import { toProduct } from "@/lib/server/products";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema } from "@/lib/validation";

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

  if (parsed.data.slug !== existing.slug) {
    const taken = await db.product.findUnique({ where: { slug: parsed.data.slug } });
    if (taken) {
      return NextResponse.json(
        { error: "Slug already in use", fields: { slug: "Another product already uses this slug" } },
        { status: 409 }
      );
    }
  }

  const updated = await db.product.update({ where: { id: params.id }, data: parsed.data });

  // Remove Cloudinary assets for images the admin took off this product.
  const kept = new Set(parsed.data.images.map((i) => i.publicId).filter(Boolean));
  await deleteImages(existing.images.map((i) => i.publicId).filter((id) => id && !kept.has(id)));

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
    ...existing.images.map((i) => i.publicId),
    ...existing.heroSlides.map((s) => s.image.publicId),
  ]);

  revalidateStorefront();
  return NextResponse.json({ ok: true, removedHeroSlides: existing.heroSlides.length });
}
