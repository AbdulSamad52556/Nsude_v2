import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit, productChanges } from "@/lib/server/audit";
import { deleteImages } from "@/lib/server/cloudinary";
import { assignVariantCodes, productImageIds, toProduct } from "@/lib/server/products";
import { syncProductListings } from "@/lib/server/listings";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema, withDerivedPrice } from "@/lib/validation";
import { logStockChange } from "@/lib/server/stockLedger";

type Params = { params: { id: string } };

const notFound = () => NextResponse.json({ error: "Product not found" }, { status: 404 });

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin("products.view");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();

  const row = await db.product.findUnique({ where: { id: params.id } });
  return row ? NextResponse.json({ product: toProduct(row) }) : notFound();
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin("products.manage");
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

  await syncProductListings(params.id);
  revalidateStorefront();
  const product = toProduct(updated);
  const changes = productChanges(toProduct(existing), product);
  // Stock ledger: stock typed in on the product page (new colours start here).
  for (const v of updated.variants) {
    const before = existing.variants.find((e) => e.code === v.code);
    await logStockChange({
      productId: updated.id,
      productName: updated.name,
      code: v.code,
      color: v.name,
      change: v.stock - (before?.stock ?? 0),
      stockAfter: v.stock,
      reason: before ? "product_edit" : "initial",
      actor: adminActor(session!.email),
    });
  }
  if (changes.length) {
    await recordAudit({
      actor: adminActor(session!.email),
      entity: "product",
      entityId: product.id,
      entityLabel: product.name,
      action: "Product updated",
      changes,
    });
  }
  return NextResponse.json({ product });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin("products.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();

  const existing = await db.product.findUnique({
    where: { id: params.id },
    include: { heroSlides: true },
  });
  if (!existing) return notFound();

  // Hero slides pointing at this product are deleted with it (cascade).
  await db.product.delete({ where: { id: params.id } });
  await syncProductListings(params.id); // removes its listings
  await deleteImages([
    ...productImageIds(existing),
    ...existing.heroSlides.map((s) => s.image.publicId),
  ]);

  revalidateStorefront();
  await recordAudit({
    actor: adminActor(session!.email),
    entity: "product",
    entityId: existing.id,
    entityLabel: existing.name,
    action: "Product deleted",
    changes: [
      { field: "Colors", from: existing.variants.map((v) => `${v.name} (${v.code})`).join(", "), to: "—" },
      ...(existing.heroSlides.length
        ? [{ field: "Hero slides removed", from: String(existing.heroSlides.length), to: "0" }]
        : []),
    ],
  });
  return NextResponse.json({ ok: true, removedHeroSlides: existing.heroSlides.length });
}
