import Link from "next/link";
import Image from "next/image";
import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { formatPrice } from "@/lib/utils";
import { priceRange, totalStock } from "@/lib/types";
import { toProduct } from "@/lib/server/products";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

type Search = { page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/products${s ? `?${s}` : ""}`;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Search }) {
  const admin = await pageAdmin("products.view");
  const canManage = can(admin, "products.manage");
  const total = await db.product.count();
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const products = (await db.product.findMany({ orderBy: { createdAt: "desc" }, skip, take: size })).map(toProduct);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? "" : "s"} in the catalog.`}
        action={
          canManage && (
            <Link
              href="/admin/products/new"
              className="rounded-md flex h-11 items-center gap-2 bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
            >
              <Plus size={16} strokeWidth={1.5} /> New Product
            </Link>
          )
        }
      />

      {products.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">
          No products yet. Create your first one.
        </p>
      ) : (
        <div className="rounded-lg overflow-x-auto border border-taupe/30">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Product</th>
                <th className="p-3 font-normal">Price</th>
                <th className="p-3 font-normal">Colors</th>
                <th className="p-3 font-normal">Stock</th>
                <th className="p-3 font-normal">Fit</th>
                <th className="p-3 font-normal">Flags</th>
                <th className="relative p-3 font-normal">
                  {/* relative: keeps the hidden label inside the table's scroll box */}
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-sand/15">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-sand/25">
                        {p.variants[0]?.images[0] && (
                          <Image src={p.variants[0].images[0].src} alt="" fill sizes="44px" className="object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="uppercase tracking-wide">{p.name}</p>
                        <p className="font-mono text-xs text-ash">{p.variants.map((v) => v.code).join(" · ")}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="p-3">
                    {(() => {
                      // Full range across every color and size.
                      const r = priceRange(p, p.variants);
                      return r.min === r.max ? formatPrice(r.min) : `${formatPrice(r.min)} – ${formatPrice(r.max)}`;
                    })()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1" title={p.variants.map((v) => `${v.name}: ${v.stock}`).join("\n")}>
                      {p.variants.map((v) => (
                        <span
                          key={v.code}
                          className="h-3.5 w-3.5 rounded-full border border-taupe/50"
                          style={{ backgroundColor: v.hex }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    {/* Total across colors; flag any color that's running low. */}
                    {totalStock(p)}
                    {p.variants.some((v) => v.stock < 15) && (
                      <span className="ml-2 text-xs text-rust">
                        {p.variants.filter((v) => v.stock < 15).length} low
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-graphite">{p.fit}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.featured && (
                        <span className="border border-taupe/50 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Featured
                        </span>
                      )}
                      {p.newArrival && (
                        <span className="border border-taupe/50 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/admin/products/${p.id}`}
                          aria-label={`Edit ${p.name}`}
                          className="p-2 text-ash hover:text-ink"
                        >
                          <Pencil size={16} strokeWidth={1.5} />
                        </Link>
                        <DeleteProductButton id={p.id} name={p.name} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        size={size}
        total={total}
        noun={total === 1 ? "product" : "products"}
        href={href}
      />
    </div>
  );
}
