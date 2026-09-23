import Link from "next/link";
import Image from "next/image";
import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const products = await db.product.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle={`${products.length} product${products.length === 1 ? "" : "s"} in the catalog.`}
        action={
          <Link
            href="/admin/products/new"
            className="flex h-11 items-center gap-2 bg-ink px-5 text-xs uppercase tracking-widest2 text-bone hover:bg-graphite"
          >
            <Plus size={16} strokeWidth={1.5} /> New Product
          </Link>
        }
      />

      {products.length === 0 ? (
        <p className="border border-graphite/15 p-8 text-center text-sm text-graphite">
          No products yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto border border-graphite/15">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-graphite/15 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Product</th>
                <th className="p-3 font-normal">Price</th>
                <th className="p-3 font-normal">Stock</th>
                <th className="p-3 font-normal">Fit</th>
                <th className="p-3 font-normal">Flags</th>
                <th className="p-3 font-normal sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite/10">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-bone/60">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-bone">
                        {p.images[0] && (
                          <Image src={p.images[0].src} alt="" fill sizes="44px" className="object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="uppercase tracking-wide">{p.name}</p>
                        <p className="text-xs text-ash">/{p.slug}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="p-3">{formatPrice(p.price)}</td>
                  <td className={p.stock < 15 ? "p-3 text-rust" : "p-3"}>{p.stock}</td>
                  <td className="p-3 text-graphite">{p.fit}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.featured && (
                        <span className="border border-graphite/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Featured
                        </span>
                      )}
                      {p.newArrival && (
                        <span className="border border-graphite/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
