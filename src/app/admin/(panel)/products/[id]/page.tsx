import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { toProduct } from "@/lib/server/products";
import { isObjectId } from "@/lib/server/revalidate";
import { productHref } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { AuditList } from "@/components/admin/AuditList";
import { ReadOnly } from "@/components/admin/ReadOnly";

export const metadata = { title: "Edit Product" };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("products.view");
  if (!isObjectId(params.id)) notFound();
  const row = await db.product.findUnique({ where: { id: params.id } });
  if (!row) notFound();
  const product = toProduct(row);
  const history = await db.auditLog.findMany({
    where: { entity: "product", entityId: product.id },
    orderBy: { at: "desc" },
    take: 100,
  });

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        subtitle={can(admin, "products.manage") ? "Changes go live on the store as soon as you save." : "View only — you can't edit products."}
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
      <ReadOnly when={!can(admin, "products.manage")}>
        <ProductForm product={product} />
      </ReadOnly>

      {/* Every edit to this product (prices, stock, colors…), old → new.
          Orders already placed keep the price they were placed at. */}
      {can(admin, "audit.view") && (
        <section className="mt-12">
          <h2 className="mb-1 text-xs uppercase tracking-widest2">Audit</h2>
          <p className="mb-4 text-xs text-ash">Orders already placed keep the price they were placed at.</p>
          <AuditList entries={history} showEntity={false} empty="No edits recorded yet." />
        </section>
      )}
    </div>
  );
}
