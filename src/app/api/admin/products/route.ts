import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { assignVariantCodes, toProduct } from "@/lib/server/products";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema, withDerivedPrice } from "@/lib/validation";

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

  const input = withDerivedPrice(parsed.data);

  // Every color of a new product gets a fresh product code. The unique
  // index is the final guard; on the (very unlikely) race where another
  // save grabbed the same code first, just draw new codes and retry.
  for (let attempt = 0; ; attempt++) {
    try {
      const variants = await assignVariantCodes(
        input.variants.map((v) => ({ ...v, code: undefined }))
      );
      const created = await db.product.create({ data: { ...input, variants } });
      revalidateStorefront();
      return NextResponse.json({ product: toProduct(created) }, { status: 201 });
    } catch (err) {
      const duplicateCode = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!duplicateCode || attempt >= 2) throw err;
    }
  }
}
