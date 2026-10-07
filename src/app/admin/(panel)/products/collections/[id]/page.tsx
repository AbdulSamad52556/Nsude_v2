import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { isObjectId } from "@/lib/server/revalidate";
import { collectionProductOptions, toCollectionData } from "@/lib/server/collections";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { AuditList } from "@/components/admin/AuditList";
import { ReadOnly } from "@/components/admin/ReadOnly";

export const metadata = { title: "Edit Collection" };

export default async function EditCollectionPage({ params }: { params: { id: string } }) {
  const admin = await pageAdmin("products.view");
  if (!isObjectId(params.id)) notFound();
  const row = await db.collection.findUnique({ where: { id: params.id } });
  if (!row) notFound();
  const [products, history] = await Promise.all([
    collectionProductOptions(),
    can(admin, "audit.view")
      ? db.auditLog.findMany({ where: { entity: "product", entityId: row.id }, orderBy: { at: "desc" }, take: 100 })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={row.name}
        subtitle={can(admin, "products.manage") ? "Changes go live on the store as soon as you save." : "View only — you can't edit collections."}
        action={
          row.active && (
            <Link
              href={`/collections/${row.slug}`}
              target="_blank"
              className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
            >
              View in store <ExternalLink size={14} strokeWidth={1.5} />
            </Link>
          )
        }
      />
      <ReadOnly when={!can(admin, "products.manage")}>
        <CollectionForm collection={toCollectionData(row)} products={products} />
      </ReadOnly>

      {can(admin, "audit.view") && (
        <section className="mt-12">
          <h2 className="mb-4 text-xs uppercase tracking-widest2">Audit</h2>
          <AuditList entries={history} showEntity={false} empty="No edits recorded yet." />
        </section>
      )}
    </div>
  );
}
