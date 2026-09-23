import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const metadata = { title: "Dashboard" };

const LOW_STOCK = 15;

export default async function AdminDashboard() {
  const [productCount, featuredCount, heroCount, lowStock] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { featured: true } }),
    db.heroSlide.count(),
    db.product.findMany({
      where: { stock: { lt: LOW_STOCK } },
      orderBy: { stock: "asc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Products", value: productCount, href: "/admin/products" },
    { label: "Featured", value: featuredCount, href: "/admin/products", hint: "Home page shows the first 4" },
    { label: "Hero slides", value: heroCount, href: "/admin/hero" },
    { label: `Low stock (<${LOW_STOCK})`, value: lowStock.length, href: "/admin/products" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Manage the catalog and the home page hero."
        action={
          <Link
            href="/admin/products/new"
            className="flex h-11 items-center gap-2 bg-ink px-5 text-xs uppercase tracking-widest2 text-bone hover:bg-graphite"
          >
            <Plus size={16} strokeWidth={1.5} /> New Product
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="border border-graphite/15 p-5 transition-colors hover:border-ink"
          >
            <p className="text-[11px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className="mt-3 text-3xl font-medium">{s.value}</p>
            {s.hint && <p className="mt-1 text-[11px] text-ash">{s.hint}</p>}
          </Link>
        ))}
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-widest2">Low stock</h2>
          <Link href="/admin/products" className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
            All products <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="border border-graphite/15 p-6 text-sm text-graphite">
            Everything has at least {LOW_STOCK} in stock.
          </p>
        ) : (
          <ul className="divide-y divide-graphite/10 border border-graphite/15">
            {lowStock.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-bone">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-bone">
                    {p.images[0] && (
                      <Image src={p.images[0].src} alt="" fill sizes="44px" className="object-cover" />
                    )}
                  </div>
                  <span className="flex-1 text-sm uppercase tracking-wide">{p.name}</span>
                  <span className={p.stock === 0 ? "text-sm text-rust" : "text-sm text-graphite"}>
                    {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
