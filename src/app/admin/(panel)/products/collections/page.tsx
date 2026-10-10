import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { PRODUCT_TABS } from "@/lib/types";
import { allCollections } from "@/lib/server/collections";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

/** Hand-picked edits and drops, each with its own page on the site. */
export default async function AdminCollectionsPage() {
  const admin = await pageAdmin("products.view");
  const canManage = can(admin, "products.manage");
  const collections = await allCollections();
  // Thumbnail fallback: the first product's photo.
  const firstIds = collections.map((c) => c.productIds[0]).filter(Boolean);
  const firsts = firstIds.length
    ? await db.listing.findMany({ where: { productId: { in: firstIds }, position: 0 }, select: { productId: true, images: true } })
    : [];
  const thumbOf = new Map(firsts.map((l) => [l.productId, l.images[0]?.src ?? null]));

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle="Collections are hand-picked edits or drops, each with its own page. A product can be in several."
        action={
          canManage && (
            <Link
              href="/admin/products/collections/new"
              className="rounded-md flex h-11 items-center gap-2 bg-ink px-5 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite"
            >
              <Plus size={16} strokeWidth={1.5} /> New Collection
            </Link>
          )
        }
      />
      <SectionTabs tabs={PRODUCT_TABS} active="/admin/products/collections" />

      {collections.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">
          No collections yet. {canManage && "Create one to give a group of products its own page."}
        </p>
      ) : (
        <div className="rounded-lg overflow-x-auto border border-taupe/30">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Collection</th>
                <th className="p-3 font-normal">Products</th>
                <th className="p-3 font-normal">Status</th>
                <th className="relative p-3 font-normal">
                  {/* relative: keeps the hidden label inside the table's scroll box */}
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {collections.map((c) => {
                const thumb = c.image?.src ?? thumbOf.get(c.productIds[0]) ?? null;
                return (
                  <tr key={c.id} className="hover:bg-sand/15">
                    <td className="p-3">
                      <Link href={`/admin/products/collections/${c.id}`} className="flex items-center gap-3">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded bg-sand/25">
                          {thumb && <Image src={thumb} alt="" fill sizes="64px" className="object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-ash">/collections/{c.slug}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-graphite">{c.productIds.length}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={
                            c.active
                              ? "rounded-full bg-ink px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-paper"
                              : "rounded-full bg-ash/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-graphite"
                          }
                        >
                          {c.active ? "On site" : "Draft"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {c.active && (
                          <Link href={`/collections/${c.slug}`} target="_blank" aria-label={`View ${c.name} on the site`} className="p-2 text-ash hover:text-ink">
                            <ExternalLink size={16} strokeWidth={1.5} />
                          </Link>
                        )}
                        <Link href={`/admin/products/collections/${c.id}`} aria-label={`Edit ${c.name}`} className="p-2 text-ash hover:text-ink">
                          <Pencil size={16} strokeWidth={1.5} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
