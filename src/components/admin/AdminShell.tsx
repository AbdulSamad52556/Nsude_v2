"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Boxes,
  Wallet,
  ExternalLink,
  History,
  Images,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Shirt,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cx } from "@/lib/utils";
import { can, type AdminIdentity, type Permission } from "@/lib/adminPermissions";
import { ActivityTracker } from "@/components/layout/ActivityTracker";
import { NavigationProgress } from "./NavigationProgress";

// `access`: who sees the link (any one of a list). Pages and APIs check again.
const nav: { href: string; label: string; icon: typeof Package; access: Permission | Permission[] }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, access: "dashboard.view" },
  { href: "/admin/users", label: "Users", icon: ShieldCheck, access: "users.view" },
  { href: "/admin/orders", label: "Orders", icon: Package, access: "orders.view" },
  { href: "/admin/products", label: "Products", icon: Shirt, access: "products.view" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, access: "inventory.view" },
  { href: "/admin/finance", label: "Finance", icon: Wallet, access: "finance.view" },
  { href: "/admin/hero", label: "Hero Carousel", icon: Images, access: "hero.view" },
  { href: "/admin/customers", label: "Customers", icon: Users, access: "customers.view" },
  { href: "/admin/activity", label: "Activity", icon: Activity, access: ["activity.view", "admin_activity.view"] },
  { href: "/admin/audit", label: "Audit", icon: History, access: "audit.view" },
];

export function AdminShell({ admin, children }: { admin: AdminIdentity; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  // The item just clicked, so the highlight moves at once instead of
  // waiting for the next page to load.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    pending ? pending === href : href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // Rendered twice (desktop + mobile drawer); each gets its own layout group
  // so the sliding highlight never jumps between them.
  const sidebar = (id: string) => (
    <LayoutGroup id={id}>
      <nav className="flex h-full flex-col gap-1 p-5" aria-label="Admin">
        <Link href="/admin" className="mb-8 flex items-center justify-center" onClick={() => setOpen(false)}>
          <Image src="/brand/nsude-logo-light.png" alt="NSUDE" width={482} height={172} className="h-6 w-auto" />
        </Link>
        {nav
          .filter(({ access }) => (Array.isArray(access) ? access : [access]).some((p) => can(admin, p)))
          .map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  setOpen(false);
                  if (!active) setPending(href);
                }}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-xs uppercase tracking-widest2 transition-colors duration-300",
                  active ? "text-sand" : "text-paper/70 hover:bg-paper/5 hover:text-paper",
                )}
              >
                {active && (
                  // Slides from the old item to the new one.
                  <motion.span
                    layoutId="admin-nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-md border-l-2 border-sand bg-paper/10"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={16} strokeWidth={1.5} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        <div className="mt-auto flex flex-col gap-1 border-t border-paper/15 pt-4">
          {admin.role === "staff" && (
            <Link
              href="/admin/account"
              onClick={() => setOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-xs uppercase tracking-widest2 hover:bg-paper/10 hover:text-paper",
                pathname === "/admin/account" ? "text-sand" : "text-paper/70"
              )}
            >
              <KeyRound size={16} strokeWidth={1.5} />
              My Password
            </Link>
          )}
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs uppercase tracking-widest2 text-paper/70 hover:bg-paper/10 hover:text-paper"
          >
            <ExternalLink size={16} strokeWidth={1.5} />
            View Store
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs uppercase tracking-widest2 text-paper/70 hover:bg-paper/10 hover:text-paper"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Log Out
          </button>
        </div>
      </nav>
    </LayoutGroup>
  );

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Admin users' pages and clicks, shown under Activity → Admin users. */}
      <ActivityTracker />
      {/* Reads the query string, so it sits in its own Suspense boundary. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-moss md:block">{sidebar("desktop")}</aside>

      {/* Mobile: top bar + slide-over sidebar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-paper/10 bg-moss px-5 py-3 md:hidden">
        <Image src="/brand/nsude-logo-light.png" alt="NSUDE" width={482} height={172} className="h-5 w-auto" />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="text-paper">
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-moss">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-4 top-4 text-paper"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            {sidebar("mobile")}
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-taupe/30 pb-6">
      <div>
        <span className="mb-3 block h-0.5 w-8 bg-sand" aria-hidden />
        <h1 className="text-2xl font-medium uppercase tracking-tighter md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-graphite">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
