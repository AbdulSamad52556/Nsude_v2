import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can, firstAllowedPage, type Permission } from "@/lib/adminPermissions";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const metadata = { title: "Dashboard" };

const LOW_STOCK = 15;

export default async function AdminDashboard() {
  const admin = await pageAdmin();
  // Without dashboard access, land on the first page they can open.
  if (!can(admin, "dashboard.view")) redirect(firstAllowedPage(admin) ?? "/admin/no-access");
  const seeProducts = can(admin, "products.view");
  const [products, heroCount, toShip] = await Promise.all([
    seeProducts ? db.product.findMany() : [],
    can(admin, "hero.view") ? db.heroSlide.count() : 0,
    can(admin, "orders.view") ? db.order.count({ where: { status: "placed" } }) : 0,
  ]);

  // Stock lives on each color, so low stock is tracked per colorway.
  const lowColors = products
    .flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })))
    .filter(({ variant }) => variant.stock < LOW_STOCK)
    .sort((a, b) => a.variant.stock - b.variant.stock);
  const lowStock = lowColors.slice(0, 8);
  const colorCount = products.reduce((n, p) => n + p.variants.length, 0);

  // Only the numbers this admin is allowed to see.
  const stats = [
    { access: "orders.view", label: "Orders to ship", value: toShip, href: "/admin/orders?status=placed", hint: "Placed, not yet shipped" },
    { access: "products.view", label: "Products", value: products.length, href: "/admin/products", hint: `${colorCount} colorways in the shop` },
    { access: "products.view", label: "Featured", value: products.filter((p) => p.featured).length, href: "/admin/products", hint: "Home page shows the first 4" },
    { access: "hero.view", label: "Hero slides", value: heroCount, href: "/admin/hero" },
    { access: "products.view", label: `Low stock (<${LOW_STOCK})`, value: lowColors.length, href: "/admin/products", hint: "Colors running low" },
  ].filter((s) => can(admin, s.access as Permission));

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle={admin.role === "superadmin" ? "Manage orders, the catalog and the home page hero." : `Signed in as ${admin.name}.`}
        action={
          can(admin, "products.manage") && (
            <Link
              href="/admin/products/new"
              className="rounded-md flex h-11 items-center gap-2 bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
            >
              <Plus size={16} strokeWidth={1.5} /> New Product
            </Link>
          )
        }
      />

      {stats.length === 0 && (
        <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">
          Your account doesn&apos;t have access to any area yet. Ask the super admin to give you permissions.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-taupe/30 p-5 transition-colors hover:border-moss"
          >
            <p className="text-[11px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className="mt-3 text-3xl font-medium">{s.value}</p>
            {s.hint && <p className="mt-1 text-[11px] text-ash">{s.hint}</p>}
          </Link>
        ))}
      </div>

      {seeProducts && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest2">Low stock</h2>
            <Link href="/admin/products" className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink">
              All products <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">
              Every color has at least {LOW_STOCK} in stock.
            </p>
          ) : (
            <ul className="rounded-lg divide-y divide-taupe/20 border border-taupe/30 overflow-hidden">
              {lowStock.map(({ product: p, variant: v }) => (
                <li key={v.code}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-sand/20">
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-sand/25">
                      {v.images[0] && (
                        <Image src={v.images[0].src} alt="" fill sizes="44px" className="object-cover" />
                      )}
                    </div>
                    <span className="flex flex-1 items-center gap-2 text-sm uppercase tracking-wide">
                      {p.name}
                      <span className="flex items-center gap-1.5 text-xs normal-case tracking-normal text-ash">
                        <span className="h-2.5 w-2.5 rounded-full border border-taupe/50" style={{ backgroundColor: v.hex }} />
                        {v.name}
                      </span>
                    </span>
                    <span className={v.stock === 0 ? "text-sm text-rust" : "text-sm text-graphite"}>
                      {v.stock === 0 ? "Sold out" : `${v.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
