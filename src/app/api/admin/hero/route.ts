import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { deleteImages } from "@/lib/server/cloudinary";
import { getHeroSlides } from "@/lib/server/products";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, heroInputSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ slides: await getHeroSlides() });
}

/** Replaces the whole carousel with the submitted slides, in order. */
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = heroInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted slides", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const { slides } = parsed.data;

  const productIds = Array.from(new Set(slides.map((s) => s.productId)));
  const found = await db.product.count({ where: { id: { in: productIds } } });
  if (found !== productIds.length) {
    return NextResponse.json({ error: "One of the selected products no longer exists" }, { status: 400 });
  }

  const previous = await db.heroSlide.findMany();
  await db.$transaction([
    db.heroSlide.deleteMany({}),
    ...slides.map((slide, position) =>
      db.heroSlide.create({
        data: { position, productId: slide.productId, image: { ...slide.image, alt: slide.image.alt ?? "" } },
      })
    ),
  ]);

  // Clean up cutouts that are no longer used by any slide.
  const kept = new Set(slides.map((s) => s.image.publicId).filter(Boolean));
  await deleteImages(previous.map((s) => s.image.publicId).filter((id) => id && !kept.has(id)));

  revalidateStorefront();
  return NextResponse.json({ slides: await getHeroSlides() });
}
