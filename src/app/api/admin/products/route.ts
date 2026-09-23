import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { toProduct } from "@/lib/server/products";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const rows = await db.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products: rows.map(toProduct) });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = productInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const taken = await db.product.findUnique({ where: { slug: parsed.data.slug } });
  if (taken) {
    return NextResponse.json(
      { error: "Slug already in use", fields: { slug: "Another product already uses this slug" } },
      { status: 409 }
    );
  }

  const created = await db.product.create({ data: parsed.data });
  revalidateStorefront();
  return NextResponse.json({ product: toProduct(created) }, { status: 201 });
}
