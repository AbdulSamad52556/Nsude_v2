import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { toProduct } from "@/lib/server/products";
import { priceFor } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminOrderForm, type CatalogColour } from "@/components/admin/AdminOrderForm";

export const metadata = { title: "New order" };

/** Enter an order taken by phone, Instagram or in person. */
export default async function NewOrderPage() {
  await pageAdmin("orders.manage");
  const products = (await db.product.findMany({ orderBy: { name: "asc" } })).map(toProduct);
  const catalog: CatalogColour[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      code: v.code,
      product: p.name,
      color: v.name,
      stock: v.stock,
      sizes: p.sizes.filter((s) => !v.unavailableSizes.includes(s)).map((s) => ({ size: s, price: priceFor(p, v, s) })),
    }))
  );

  return (
    <div>
      <Link href="/admin/orders" className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> All orders
      </Link>
      <AdminPageHeader
        title="New order"
        subtitle="For orders taken by phone, Instagram or in person. Prices come from the catalogue; stock is taken when you save."
      />
      <AdminOrderForm catalog={catalog} />
    </div>
  );
}
