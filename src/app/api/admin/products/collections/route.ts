import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { checkCollection, clearOtherFeatured, collectionChanges, collectionData } from "@/lib/server/collectionSave";
import { collectionInputSchema, fieldErrors } from "@/lib/validation";

/** Creates a collection. */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  const parsed = collectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const problem = await checkCollection(input);
  if (problem) return NextResponse.json({ error: problem.error, fields: problem.fields }, { status: problem.status });

  const created = await db.collection.create({
    data: { ...collectionData(input), sortOrder: await db.collection.count() },
  });
  if (created.featured) await clearOtherFeatured(created.id);

  await recordAudit({
    actor: adminActor(admin.email),
    entity: "product",
    entityId: created.id,
    entityLabel: `Collection · ${created.name}`,
    action: "Collection added",
    changes: await collectionChanges(null, input),
  });
  revalidateStorefront();
  return NextResponse.json({ id: created.id }, { status: 201 });
}
