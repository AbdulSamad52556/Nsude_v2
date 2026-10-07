import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId, revalidateStorefront } from "@/lib/server/revalidate";
import { topLevelCategory } from "@/lib/server/productCategories";
import { categoryKey } from "@/lib/types";

type Params = { params: { id: string } };
const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40).optional(),
  active: z.boolean().optional(),
});

async function load(id: string) {
  if (!isObjectId(id)) return null;
  const category = await db.productCategory.findUnique({ where: { id } });
  if (!category) return null;
  const parent = category.parentId ? await db.productCategory.findUnique({ where: { id: category.parentId } }) : null;
  return { category, parent, label: parent ? `${parent.name} › ${category.name}` : category.name };
}

/** Products (and shop listings) in this category / sub-category. */
const productsIn = (category: { name: string }, parent: { name: string } | null) =>
  parent ? { category: parent.name, subcategory: category.name } : { category: category.name };

/**
 * Renames a category (its products and shop links follow), or hides / shows
 * it. Hidden categories disappear from the shop filters and can't be picked
 * for products; products already in them stay where they are.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  const found = await load(params.id);
  if (!found) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  const { name, active } = parsed.data;
  const { category, parent, label } = found;
  const renaming = Boolean(name && name !== category.name);

  if (renaming) {
    if (!categoryKey(name!)) return NextResponse.json({ error: "Use letters or numbers in the name." }, { status: 400 });
    const siblings = await db.productCategory.findMany({
      where: { ...(category.parentId ? { parentId: category.parentId } : topLevelCategory), id: { not: category.id } },
    });
    if (siblings.some((s) => categoryKey(s.name) === categoryKey(name!))) {
      return NextResponse.json({ error: `"${name}" already exists here.` }, { status: 409 });
    }
  }

  await db.productCategory.update({
    where: { id: category.id },
    data: { ...(renaming ? { name } : {}), ...(active !== undefined ? { active } : {}) },
  });

  // Products keep category names: move them (and their listings) to the new name.
  let moved = 0;
  if (renaming) {
    const where = productsIn(category, parent);
    moved = (
      await db.product.updateMany({ where, data: parent ? { subcategory: name } : { category: name } })
    ).count;
    await db.listing.updateMany({
      where,
      data: parent ? { subcategory: name, subcategoryKey: categoryKey(name!) } : { category: name, categoryKey: categoryKey(name!) },
    });
  }

  const changes = [
    ...(renaming ? [{ field: "Name", from: category.name, to: name! }] : []),
    ...(renaming && moved ? [{ field: "Products moved", from: "—", to: String(moved) }] : []),
    ...(active !== undefined && active !== category.active
      ? [{ field: "Status", from: category.active ? "Shown" : "Hidden", to: active ? "Shown" : "Hidden" }]
      : []),
  ];
  if (changes.length) {
    await recordAudit({
      actor: adminActor(admin.email),
      entity: "product",
      entityId: category.id,
      entityLabel: `Category · ${label}`,
      action: "Category updated",
      changes,
    });
  }
  revalidateStorefront();
  return NextResponse.json({ ok: true });
}

/** Deletes a category no product uses (otherwise hide it instead). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  const found = await load(params.id);
  if (!found) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  const { category, parent, label } = found;
  const [children, used] = await Promise.all([
    db.productCategory.count({ where: { parentId: category.id } }),
    db.product.count({ where: productsIn(category, parent) }),
  ]);
  if (children > 0) {
    return NextResponse.json({ error: "Delete or hide its sub-categories first, or hide this one." }, { status: 409 });
  }
  if (used > 0) {
    return NextResponse.json({ error: `Used by ${used} product${used === 1 ? "" : "s"}. Hide it instead.` }, { status: 409 });
  }
  await db.productCategory.delete({ where: { id: category.id } });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "product",
    entityId: category.id,
    entityLabel: `Category · ${label}`,
    action: "Category deleted",
    changes: [{ field: "Name", from: label, to: "—" }],
  });
  revalidateStorefront();
  return NextResponse.json({ ok: true });
}
