import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/server/db";
import { toProduct } from "@/lib/server/products";
import { isObjectId } from "@/lib/server/revalidate";
import { productHref } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Edit Product" };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  if (!isObjectId(params.id)) notFound();
  const row = await db.product.findUnique({ where: { id: params.id } });
  if (!row) notFound();
  const product = toProduct(row);

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        subtitle="Changes go live on the store as soon as you save."
        action={
          <Link
            href={productHref(product.variants[0])}
            target="_blank"
            className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
          >
            View in store <ExternalLink size={14} strokeWidth={1.5} />
          </Link>
        }
      />
      <ProductForm product={product} />
    </div>
  );
}
