import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination, readPaging } from "@/components/admin/Pagination";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

type Search = { q?: string; page?: string; size?: string };

function href(params: Search) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/admin/customers${s ? `?${s}` : ""}`;
}

/** Customer accounts (phone + OTP sign-ups), newest first. */
export default async function CustomersPage({ searchParams }: { searchParams: Search }) {
  await pageAdmin("customers.view");
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { phone: { contains: q.replace(/\D/g, "").slice(-10) || safe } },
          { name: { contains: safe, mode: "insensitive" } },
          { email: { contains: safe, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await db.customer.count({ where });
  const { page, pages, size, skip } = readPaging(searchParams, total);
  const customers = await db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: size });
  const orderCounts = await Promise.all(
    customers.map((c) => db.order.count({ where: { OR: [{ customerId: c.id }, { phone: c.phone }] } }))
  );
  const date = (d: Date) => d.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

  return (
    <div>
      <AdminPageHeader title="Customers" subtitle={`${total} account${total === 1 ? "" : "s"} · sign-in is by mobile number and one-time code.`} />

      <form action="/admin/customers" className="mb-6 flex gap-2">
        {searchParams.size && <input type="hidden" name="size" value={searchParams.size} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Phone, name or email"
          className="rounded-md h-10 w-64 border border-taupe/50 bg-transparent px-3 text-sm focus:border-moss focus:outline-none"
        />
        <button type="submit" className="rounded-md h-10 bg-moss px-4 text-xs uppercase tracking-widest2 text-paper hover:brightness-90">
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-taupe/30 p-8 text-center text-sm text-graphite">{q ? "No customers match." : "No customer accounts yet."}</p>
      ) : (
        <div className="rounded-lg overflow-x-auto border border-taupe/30">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-taupe/30 bg-sand/30 text-[11px] uppercase tracking-widest2 text-ash">
              <tr>
                <th className="p-3 font-normal">Mobile</th>
                <th className="p-3 font-normal">Name</th>
                <th className="p-3 font-normal">Email</th>
                <th className="p-3 font-normal">Orders</th>
                <th className="p-3 font-normal">Addresses</th>
                <th className="p-3 font-normal">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {customers.map((c, i) => (
                <tr key={c.id} className="hover:bg-sand/15">
                  <td className="p-3">
                    <Link href={`/admin/customers/${c.id}`} className="underline-offset-4 hover:underline">
                      +91 {c.phone}
                    </Link>
                  </td>
                  <td className="p-3">{c.name || <span className="text-ash">—</span>}</td>
                  <td className="p-3 text-graphite">{c.email || <span className="text-ash">—</span>}</td>
                  <td className="p-3">{orderCounts[i]}</td>
                  <td className="p-3">{c.addresses.length}</td>
                  <td className="whitespace-nowrap p-3 text-graphite">{date(c.createdAt)}</td>
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
        noun={total === 1 ? "customer" : "customers"}
        href={(p) => href({ q, ...p })}
      />
    </div>
  );
}
