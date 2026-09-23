"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Images, LayoutDashboard, LogOut, Menu, Shirt, X } from "lucide-react";
import { cx } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Shirt },
  { href: "/admin/hero", label: "Hero Carousel", icon: Images },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-5" aria-label="Admin">
      <Link href="/admin" className="mb-8 flex items-center gap-2" onClick={() => setOpen(false)}>
        <Image src="/brand/nsude-logo-light.png" alt="NSUDE" width={482} height={172} className="h-6 w-auto" />
        <span className="text-[10px] uppercase tracking-widest2 text-stone">Admin</span>
      </Link>
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cx(
            "flex items-center gap-3 px-3 py-2.5 text-xs uppercase tracking-widest2 transition-colors",
            isActive(href) ? "bg-bone/10 text-bone" : "text-stone hover:text-bone"
          )}
        >
          <Icon size={16} strokeWidth={1.5} />
          {label}
        </Link>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-graphite pt-4">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 text-xs uppercase tracking-widest2 text-stone hover:text-bone"
        >
          <ExternalLink size={16} strokeWidth={1.5} />
          View Store
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 text-left text-xs uppercase tracking-widest2 text-stone hover:text-bone"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Log Out
        </button>
        <p className="truncate px-3 pt-2 text-[11px] text-stone" title={email}>
          {email}
        </p>
      </div>
    </nav>
  );

  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-ink md:block">{sidebar}</aside>

      {/* Mobile: top bar + slide-over sidebar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-5 py-3 md:hidden">
        <Image src="/brand/nsude-logo-light.png" alt="NSUDE" width={482} height={172} className="h-5 w-auto" />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="text-bone">
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-4 top-4 text-bone"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main-content" className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-graphite/15 pb-6">
      <div>
        <h1 className="text-2xl font-medium uppercase tracking-tighter md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-graphite">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
