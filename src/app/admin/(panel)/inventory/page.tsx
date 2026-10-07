import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { cx, formatPrice } from "@/lib/utils";
import { priceRange } from "@/lib/types";
import { toProduct } from "@/lib/server/products";
import { INVENTORY_TABS, LOW_STOCK } from "@/lib/inventory";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { StockAdjustButton } from "@/components/admin/StockAdjustButton";

export const metadata = { title: "Inventory" };

type Search = { status?: string; sort?: string; q?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/inventory${s ? `?${s}` : ""}`;
}

const STATUSES = [
  { key: "", label: "All" },
  { key: "low", label: `Low (<${LOW_STOCK})` },
  { key: "out", label: "Sold out" },
  { key: "in", label: "In stock" },
] as const;

/** Stock of every colourway, with what sold recently and quick adjustments. */
export default async function InventoryPage({ searchParams }: { searchParams: Search }) {
  const admin = await pageAdmin("inventory.view");
  const canManage = can(admin, "inventory.manage");
  const status = STATUSES.find((s) => s.key && s.key === searchParams.status)?.key;
  const sort = searchParams.sort === "name" ? "name" : "stock";
  const q = (searchParams.q ?? "").trim().toLowerCase().slice(0, 60);

  const since = new Date(Date.now() - 30 * 864e5);
  const [products, soldRows] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" } }),
    // Units sold in the last 30 days (sales minus cancellations / edits).
    db.stockMovement.groupBy({
      by: ["code"],
      where: { at: { gte: since }, reason: { in: ["sale", "order_cancelled", "order_edited"] } },
      _sum: { change: true },
    }),
  ]);
  const sold = new Map(soldRows.map((r) => [r.code, -(r._sum.change ?? 0)]));

  const all = products.map(toProduct).flatMap((p) =>
    p.variants.map((v) => ({
      product: p,
      variant: v,
      price: priceRange(p, [v]).min,
      sold30: Math.max(0, sold.get(v.code) ?? 0),
    }))
  );
  const stats = {
    units: all.reduce((n, r) => n + r.variant.stock, 0),
    colourways: all.length,
    low: all.filter((r) => r.variant.stock > 0 && r.variant.stock < LOW_STOCK).length,
    out: all.filter((r) => r.variant.stock === 0).length,
    value: all.reduce((n, r) => n + r.variant.stock * r.price, 0),
  };

  const rows = all
    .filter((r) =>
      status === "low"
        ? r.variant.stock > 0 && r.variant.stock < LOW_STOCK
        : status === "out"
          ? r.variant.stock === 0
          : status === "in"
            ? r.variant.stock > 0
            : true
    )
    .filter((r) => !q || `${r.product.name} ${r.variant.name} ${r.variant.code}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === "stock" ? a.variant.stock - b.variant.stock : 0) || a.product.name.localeCompare(b.product.name));
  const { page, pages, size, skip } = readPaging(searchParams, rows.length);
  const shown = rows.slice(skip, skip + size);

  const base = { status, sort: sort === "name" ? "name" : undefined, q: searchParams.q, size: searchParams.size };
  const chip = (active: boolean) =>
    cx(
      "rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-widest2",
      active ? "border-ink bg-ink text-paper" : "border-taupe/50 text-graphite hover:border-ink"
    );

  return (
    <div>
      <AdminPageHeader title="Inventory" subtitle={`${stats.units} units across ${stats.colourways} colours.`} />
      <SectionTabs tabs={INVENTORY_TABS} active="/admin/inventory" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Units in stock", value: String(stats.units) },
          { label: "Colours", value: String(stats.colourways) },
          { label: `Low stock (<${LOW_STOCK})`, value: String(stats.low), warn: stats.low > 0 },
          { label: "Sold out", value: String(stats.out), warn: stats.out > 0 },
          { label: "Stock value (at price)", value: formatPrice(stats.value) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-taupe/30 p-4">
            <p className="text-[10px] uppercase tracking-widest2 text-ash">{s.label}</p>
            <p className={cx("mt-2 text-2xl font-medium", s.warn && "text-rust")}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link key={s.label} href={href({ ...base, status: s.key || undefined })} className={chip((status ?? "") === s.key)}>
              {s.label}
            </Link>
          ))}
          <span className="mx-1 hidden w-px bg-taupe/30 sm:block" />
          <Link href={href({ ...base, sort: undefined })} className={chip(sort === "stock")}>
            Lowest first
          </Link>
          <Link href={href({ ...base, sort: "name" })} className={chip(sort === "name")}>
            By name
          </Link>
        </div>
        <form action="/admin/inventory" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {sort === "name" && <input type="hidden" name="sort" value="name" />}
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Product, colour or code"
            className="h-10 w-56 rounded-md border border-taupe/50 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-md bg-ink px-4 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite">
            Search
          </button>
        </form>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">No colours match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe/30">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Product · colour</th>
                <th className="p-3 font-normal">Code</th>
                <th className="p-3 font-normal">Price</th>
                <th className="p-3 font-normal">In stock</th>
                <th className="p-3 font-normal">Sold (30 days)</th>
                <th className="p-3 font-normal">Value</th>
                <th className="relative p-3 font-normal">
                  {/* relative: keeps the hidden label inside the table's scroll box */}
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {shown.map(({ product: p, variant: v, price, sold30 }) => (
                <tr key={v.code} className="hover:bg-sand/15">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-sand/25">
                        {v.images[0] && <Image src={v.images[0].src} alt="" fill sizes="40px" className="object-cover" />}
                      </div>
                      <div>
                        <p className="uppercase tracking-wide">{p.name}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ash">
                          <span className="h-2.5 w-2.5 rounded-full border border-taupe/50" style={{ backgroundColor: v.hex }} />
                          {v.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-graphite">{v.code}</td>
                  <td className="p-3 text-graphite">{formatPrice(price)}</td>
                  <td className="p-3">
                    <span
                      className={cx(
                        "inline-block min-w-[3rem] rounded-full border px-2 py-0.5 text-center text-xs",
                        v.stock === 0
                          ? "border-rust/40 text-rust"
                          : v.stock < LOW_STOCK
                            ? "border-sand bg-sand/50 text-ink"
                            : "border-taupe/40 text-ink"
                      )}
                    >
                      {v.stock === 0 ? "Sold out" : v.stock}
                    </span>
                  </td>
                  <td className="p-3 text-graphite">{sold30}</td>
                  <td className="p-3 text-graphite">{formatPrice(v.stock * price)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/inventory/ledger?code=${v.code}`}
                        className="text-[10px] uppercase tracking-widest2 text-ash underline-offset-4 hover:text-ink hover:underline"
                      >
                        Ledger
                      </Link>
                      {canManage && <StockAdjustButton code={v.code} name={`${p.name} · ${v.name}`} stock={v.stock} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} size={size} total={rows.length} noun="colours" href={(p) => href({ ...base, ...p })} />
    </div>
  );
}
