import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { deleteImages } from "@/lib/server/cloudinary";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { checkCollection, clearOtherFeatured, collectionChanges, collectionData } from "@/lib/server/collectionSave";
import { collectionInputSchema, fieldErrors } from "@/lib/validation";

type Params = { params: { id: string } };

const notFound = () => NextResponse.json({ error: "That collection no longer exists." }, { status: 404 });

/** Saves the whole collection (details, banner, products and their order). */
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();
  const existing = await db.collection.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const parsed = collectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const problem = await checkCollection(input, existing.id);
  if (problem) return NextResponse.json({ error: problem.error, fields: problem.fields }, { status: problem.status });

  const changes = await collectionChanges(existing, input);
  const updated = await db.collection.update({ where: { id: existing.id }, data: collectionData(input) });
  if (updated.featured) await clearOtherFeatured(updated.id);
  // A replaced or removed banner photo is no longer needed.
  if (existing.image?.publicId && existing.image.publicId !== updated.image?.publicId) {
    await deleteImages([existing.image.publicId]);
  }

  if (changes.length) {
    await recordAudit({
      actor: adminActor(admin.email),
      entity: "product",
      entityId: updated.id,
      entityLabel: `Collection · ${updated.name}`,
      action: "Collection updated",
      changes,
    });
  }
  revalidateStorefront();
  return NextResponse.json({ ok: true });
}

/** Deletes a collection. Its products stay in the shop. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();
  const existing = await db.collection.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  await db.collection.delete({ where: { id: existing.id } });
  await deleteImages([existing.image?.publicId]);
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "product",
    entityId: existing.id,
    entityLabel: `Collection · ${existing.name}`,
    action: "Collection deleted",
    changes: [{ field: "Collection", from: `${existing.name} (${existing.productIds.length} products)`, to: "—" }],
  });
  revalidateStorefront();
  return NextResponse.json({ ok: true });
}
