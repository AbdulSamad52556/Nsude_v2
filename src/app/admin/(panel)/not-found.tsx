import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { getAdmin } from "@/lib/server/auth";
import { firstAllowedPage } from "@/lib/adminPermissions";

/** Admin 404: unknown admin URLs, and orders / products / users / customers
    that don't exist (or were deleted). */
export default async function AdminNotFound() {
  const admin = await getAdmin();
  const home = admin ? firstAllowedPage(admin) : null;

  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand/50 text-moss">
        <SearchX size={22} strokeWidth={1.5} />
      </span>
      <p className="mt-5 text-[11px] uppercase tracking-widest2 text-ash">Error 404</p>
      <h1 className="mt-2 text-xl font-medium uppercase tracking-tighter md:text-2xl">Not found</h1>
      <p className="mt-2 text-sm text-graphite">
        This page doesn&apos;t exist, or what it pointed to — an order, product, customer or user — has been removed.
      </p>
      {home && (
        <Link
          href={home}
          className="mt-6 flex h-10 items-center gap-2 rounded-md bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {home === "/admin" ? "Back to dashboard" : "Go back"}
        </Link>
      )}
    </div>
  );
}
