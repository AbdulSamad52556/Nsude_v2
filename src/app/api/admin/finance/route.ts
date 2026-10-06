import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor } from "@/lib/server/audit";
import { isObjectId } from "@/lib/server/revalidate";
import { LIVE, MAX_ATTACHMENTS, attachmentSchema, auditEntry, entryDate, financeEmployees } from "@/lib/server/finance";
import { FINANCE_TYPES, MANUAL_TYPES, parseRupees } from "@/lib/finance";
import { fieldErrors } from "@/lib/validation";

const schema = z.object({
  type: z.enum([...MANUAL_TYPES, "opening"]),
  amount: z.string().max(20),
  /** For corrections and the opening balance: money in or out. */
  direction: z.enum(["in", "out"]).default("in"),
  date: z.string().max(10).optional(),
  method: z.string().max(20).optional(),
  /** Expense category (and optional sub-category), by id. */
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  /** Who was paid / who paid us. */
  vendor: z.string().trim().max(100).optional(),
  description: z.string().trim().max(300).optional(),
  employeeEmail: z.string().trim().toLowerCase().max(200).optional(),
  reference: z.string().trim().max(100).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).default([]),
});

/** Adds a money entry by hand: opening balance, expense, employee money, other income or a correction. */
export async function POST(request: NextRequest) {
  const { error, admin } = await requireAdmin("finance.manage");
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const b = parsed.data;
  const fields: Record<string, string> = {};

  const paise = parseRupees(b.amount);
  if (paise === null || paise === 0) fields.amount = "Enter an amount, e.g. 1500 or 249.50";

  let employee: { email: string; name: string } | undefined;
  if (b.type === "employee_withdrawal" || b.type === "employee_deposit") {
    employee = (await financeEmployees()).find((e) => e.email === b.employeeEmail);
    if (!employee) fields.employeeEmail = "Choose who took or added the money";
  }

  // Expenses: a shown category, and optionally one of its shown sub-categories.
  let category: { id: string; name: string } | null = null;
  let subcategory: { id: string; name: string } | null = null;
  if (b.type === "expense") {
    const cat = b.categoryId && isObjectId(b.categoryId) ? await db.expenseCategory.findUnique({ where: { id: b.categoryId } }) : null;
    if (!cat || cat.parentId || !cat.active) fields.categoryId = "Choose a category";
    else category = cat;
    if (cat && b.subcategoryId) {
      const sub = isObjectId(b.subcategoryId) ? await db.expenseCategory.findUnique({ where: { id: b.subcategoryId } }) : null;
      if (!sub || sub.parentId !== cat.id || !sub.active) fields.subcategoryId = "Choose a sub-category";
      else subcategory = sub;
    }
    if (!b.description) fields.description = "What was it for?";
  }
  if ((b.type === "income" || b.type === "adjustment") && !b.description) fields.description = "Add a short note";
  if (b.type === "opening" && (await db.financeEntry.count({ where: { AND: [LIVE, { type: "opening" }] } })) > 0) {
    return NextResponse.json({ error: "The opening balance is already set. Use a correction to change the balance." }, { status: 409 });
  }
  if (Object.keys(fields).length) return NextResponse.json({ error: "Please fix the highlighted fields", fields }, { status: 400 });

  // Sign: expenses and money taken go out; corrections / opening follow `direction`.
  const fixed = FINANCE_TYPES[b.type].sign;
  const sign = fixed !== 0 ? fixed : b.direction === "out" ? -1 : 1;
  const label = FINANCE_TYPES[b.type].label;
  const description =
    b.description ||
    (employee ? `${label} · ${employee.name}` : b.type === "opening" ? "Opening balance (money in the bank)" : label);

  const entry = await db.financeEntry.create({
    data: {
      at: entryDate(b.date),
      type: b.type,
      amount: sign * paise!,
      method: b.method || null,
      category: category?.name ?? null,
      categoryId: category?.id ?? null,
      subcategory: subcategory?.name ?? null,
      subcategoryId: subcategory?.id ?? null,
      vendor: b.vendor || null,
      description,
      employeeEmail: employee?.email ?? null,
      employeeName: employee?.name ?? null,
      reference: b.reference || null,
      attachments: b.attachments,
      createdBy: admin.email,
    },
  });
  await auditEntry(entry, adminActor(admin.email), sign > 0 ? "Money in" : "Money out");
  return NextResponse.json({ id: entry.id }, { status: 201 });
}
