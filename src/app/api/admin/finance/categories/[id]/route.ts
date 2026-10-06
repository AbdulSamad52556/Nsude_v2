import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { topLevel } from "@/lib/server/expenseCategories";

type Params = { params: { id: string } };
const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40).optional(),
  active: z.boolean().optional(),
});

async function load(id: string) {
  if (!isObjectId(id)) return null;
  const category = await db.expenseCategory.findUnique({ where: { id } });
  if (!category) return null;
  const parent = category.parentId ? await db.expenseCategory.findUnique({ where: { id: category.parentId } }) : null;
  return { category, parent, label: parent ? `${parent.name} › ${category.name}` : category.name };
}

/** Renames a category, or hides / shows it. Existing entries keep the name
    they were saved with; hidden categories just can't be picked any more. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("finance.manage");
  if (error) return error;
  const found = await load(params.id);
  if (!found) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  const { name, active } = parsed.data;
  const { category, label } = found;

  if (name && name.toLowerCase() !== category.name.toLowerCase()) {
    const clash = await db.expenseCategory.findFirst({
      where: {
        ...(category.parentId ? { parentId: category.parentId } : topLevel),
        id: { not: category.id },
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (clash) return NextResponse.json({ error: `"${name}" already exists here.` }, { status: 409 });
  }
  await db.expenseCategory.update({
    where: { id: category.id },
    data: { ...(name ? { name } : {}), ...(active !== undefined ? { active } : {}) },
  });
  const changes = [
    ...(name && name !== category.name ? [{ field: "Name", from: category.name, to: name }] : []),
    ...(active !== undefined && active !== category.active
      ? [{ field: "Status", from: category.active ? "Shown" : "Hidden", to: active ? "Shown" : "Hidden" }]
      : []),
  ];
  if (changes.length) {
    await recordAudit({
      actor: adminActor(admin.email),
      entity: "finance",
      entityId: category.id,
      entityLabel: `Category · ${label}`,
      action: "Expense category updated",
      changes,
    });
  }
  return NextResponse.json({ ok: true });
}

/** Deletes a category nobody has used yet (otherwise hide it instead). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, admin } = await requireAdmin("finance.manage");
  if (error) return error;
  const found = await load(params.id);
  if (!found) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  const { category, label } = found;
  const [children, used] = await Promise.all([
    db.expenseCategory.count({ where: { parentId: category.id } }),
    db.financeEntry.count({ where: { OR: [{ categoryId: category.id }, { subcategoryId: category.id }] } }),
  ]);
  if (children > 0) {
    return NextResponse.json({ error: "Delete or hide its sub-categories first, or hide this one." }, { status: 409 });
  }
  if (used > 0) {
    return NextResponse.json({ error: `Used by ${used} entr${used === 1 ? "y" : "ies"}. Hide it instead.` }, { status: 409 });
  }
  await db.expenseCategory.delete({ where: { id: category.id } });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "finance",
    entityId: category.id,
    entityLabel: `Category · ${label}`,
    action: "Expense category deleted",
    changes: [{ field: "Name", from: label, to: "—" }],
  });
  return NextResponse.json({ ok: true });
}
