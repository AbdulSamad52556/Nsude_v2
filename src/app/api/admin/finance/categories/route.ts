import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { topLevel } from "@/lib/server/expenseCategories";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40),
  parentId: z.string().optional(),
});

/** Adds an expense category, or a sub-category under one. */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("finance.manage");
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a name" }, { status: 400 });
  const { name, parentId } = parsed.data;

  let parent = null;
  if (parentId) {
    parent = isObjectId(parentId) ? await db.expenseCategory.findUnique({ where: { id: parentId } }) : null;
    if (!parent || parent.parentId) return NextResponse.json({ error: "That category no longer exists." }, { status: 404 });
  }
  const siblings = await db.expenseCategory.findMany({ where: parent ? { parentId: parent.id } : topLevel });
  if (siblings.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: `"${name}" already exists here.` }, { status: 409 });
  }
  const created = await db.expenseCategory.create({
    data: { name, parentId: parent?.id ?? null, sortOrder: siblings.length },
  });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "finance",
    entityId: created.id,
    entityLabel: parent ? `Category · ${parent.name} › ${name}` : `Category · ${name}`,
    action: parent ? "Sub-category added" : "Expense category added",
    changes: [{ field: "Name", from: "—", to: parent ? `${parent.name} › ${name}` : name }],
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
