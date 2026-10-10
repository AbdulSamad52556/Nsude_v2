import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { toProduct } from "@/lib/server/products";
import { getCustomSettings } from "@/lib/server/custom";
import { PRINT_SIDES, sidePhoto, type PrintSide } from "@/lib/custom";
import { PRODUCT_TABS, priceRange, totalStock } from "@/lib/types";
import { formatPriceRange } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { CustomSettingsForm } from "@/components/admin/CustomSettingsForm";

export const metadata = { title: "Custom tees" };
export const dynamic = "force-dynamic";

/** Blank tees customers print on, and the custom-print prices. */
export default async function AdminCustomTeesPage() {
  const admin = await pageAdmin("products.view");
  const canManage = can(admin, "products.manage");
  const [settings, rows] = await Promise.all([
    getCustomSettings(),
    db.product.findMany({ where: { blank: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const blanks = rows.map(toProduct);
  const first = blanks.find((b) => b.variants[0]?.images.length)?.variants[0];

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle="Customers design their own print on a blank tee at /customize."
        action={
          <Link href="/customize" target="_blank" className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
            Open designer <ExternalLink size={14} strokeWidth={1.5} />
          </Link>
        }
      />
      <SectionTabs tabs={PRODUCT_TABS} active="/admin/products/custom" />

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-widest2">Blank tees</h2>
            <p className="mt-1 text-xs text-ash">
              Plain tees offered for printing. Stock and sizes work like any product (also under Inventory).
            </p>
          </div>
          {canManage && (
            <Link
              href="/admin/products/new?blank=1"
              className="rounded-md flex h-10 items-center gap-2 bg-ink px-4 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite"
            >
              <Plus size={15} strokeWidth={1.5} /> New blank tee
            </Link>
          )}
        </div>
        {blanks.length === 0 ? (
          <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">
            No blank tees yet. Add one (with front and back photos per colour) to open the designer.
          </p>
        ) : (
          <div className="rounded-lg overflow-x-auto border border-taupe/30">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
                <tr>
                  <th className="p-3 font-normal">Blank</th>
                  <th className="p-3 font-normal">Price</th>
                  <th className="p-3 font-normal">Colours</th>
                  <th className="p-3 font-normal">Stock</th>
                  <th className="relative p-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-taupe/20">
                {blanks.map((b) => (
                  <tr key={b.id} className="hover:bg-sand/15">
                    <td className="p-3">
                      <Link href={`/admin/products/${b.id}`} className="flex items-center gap-3">
                        <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-sand/25">
                          {b.variants[0]?.images[0] && <Image src={b.variants[0].images[0].src} alt="" fill sizes="44px" className="object-cover" />}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{b.name}</p>
                          <p className="text-xs text-ash">{b.fit} fit</p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-graphite">{formatPriceRange(priceRange(b, b.variants))}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {b.variants.map((v) => (
                          <span
                            key={v.code}
                            title={`${v.name} · ${v.images.length >= 4 ? "front, back, left, right" : `${v.images.length} of 4 view photos`}`}
                            className="h-4 w-4 rounded-full border border-taupe/60"
                            style={{ backgroundColor: v.hex }}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-graphite">{totalStock(b)}</td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        <Link href={`/admin/products/${b.id}`} aria-label={`Edit ${b.name}`} className="p-2 text-ash hover:text-ink">
                          <Pencil size={16} strokeWidth={1.5} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReadOnly when={!canManage}>
        <CustomSettingsForm
          initial={settings}
          mockups={Object.fromEntries(PRINT_SIDES.map((s) => [s, first ? sidePhoto(first.images, s) : null])) as Record<PrintSide, string | null>}
        />
      </ReadOnly>
    </div>
  );
}
