import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit, productSnapshot } from "@/lib/server/audit";
import { assignVariantCodes, toProduct } from "@/lib/server/products";
import { syncProductListings } from "@/lib/server/listings";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { fieldErrors, productInputSchema, withDerivedPrice } from "@/lib/validation";
import { logStockChange } from "@/lib/server/stockLedger";

export async function GET() {
  const { error } = await requireAdmin("products.view");
  if (error) return error;

  const rows = await db.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products: rows.map(toProduct) });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin("products.manage");
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
  let created;
  for (let attempt = 0; ; attempt++) {
    try {
      const variants = await assignVariantCodes(
        input.variants.map((v) => ({ ...v, code: undefined }))
      );
      created = await db.product.create({ data: { ...input, variants } });
      break;
    } catch (err) {
      const duplicateCode = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!duplicateCode || attempt >= 2) throw err;
    }
  }

  // Outside the retry loop: the product exists now, so never re-create it.
  await syncProductListings(created.id);
  revalidateStorefront();
  const product = toProduct(created);
  await recordAudit({
    actor: adminActor(session!.email),
    entity: "product",
    entityId: product.id,
    entityLabel: product.name,
    action: "Product created",
    changes: productSnapshot(product),
  });
  // Stock ledger: each colour starts with its opening stock.
  for (const v of created.variants) {
    await logStockChange({
      productId: created.id,
      productName: created.name,
      code: v.code,
      color: v.name,
      change: v.stock,
      stockAfter: v.stock,
      reason: "initial",
      actor: adminActor(session!.email),
    });
  }
  return NextResponse.json({ product }, { status: 201 });
}
