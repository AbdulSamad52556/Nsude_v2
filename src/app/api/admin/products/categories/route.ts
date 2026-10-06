import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { productCategoryTree, topLevelCategory } from "@/lib/server/productCategories";
import { categoryKey } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40),
  parentId: z.string().optional(),
});

/** Adds a shop category, or a sub-category under one. */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a name" }, { status: 400 });
  const { name, parentId } = parsed.data;
  if (!categoryKey(name)) return NextResponse.json({ error: "Use letters or numbers in the name." }, { status: 400 });

  await productCategoryTree(); // starting list exists
  let parent = null;
  if (parentId) {
    parent = isObjectId(parentId) ? await db.productCategory.findUnique({ where: { id: parentId } }) : null;
    if (!parent || parent.parentId) return NextResponse.json({ error: "That category no longer exists." }, { status: 404 });
  }
  const siblings = await db.productCategory.findMany({ where: parent ? { parentId: parent.id } : topLevelCategory });
  // Names must differ in their URL key too ("Long Sleeve" vs "long-sleeve").
  if (siblings.some((s) => categoryKey(s.name) === categoryKey(name))) {
    return NextResponse.json({ error: `"${name}" already exists here.` }, { status: 409 });
  }
  const created = await db.productCategory.create({
    data: { name, parentId: parent?.id ?? null, sortOrder: siblings.length },
  });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "product",
    entityId: created.id,
    entityLabel: parent ? `Category · ${parent.name} › ${name}` : `Category · ${name}`,
    action: parent ? "Sub-category added" : "Category added",
    changes: [{ field: "Name", from: "—", to: parent ? `${parent.name} › ${name}` : name }],
  });
  revalidateStorefront();
  return NextResponse.json({ id: created.id }, { status: 201 });
}
