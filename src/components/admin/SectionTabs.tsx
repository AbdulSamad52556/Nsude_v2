import Link from "next/link";
import { cx } from "@/lib/utils";

/** Tabs under a page header (e.g. Inventory: Stock / Ledger). */
export function SectionTabs({ tabs, active }: { tabs: { href: string; label: string }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="mb-6 inline-flex max-w-full overflow-x-auto rounded-md border border-taupe/50 p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? "page" : undefined}
          className={cx(
            "whitespace-nowrap rounded px-4 py-2 text-[11px] uppercase tracking-widest2 transition-colors",
            active === t.href ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
