import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/lib/utils";

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Reads ?page= and ?size= for an admin list. The page is clamped once the
 * total is known, so a stale link past the end shows the last page.
 */
export function readPaging(search: { page?: string; size?: string }, total: number) {
  const size = PAGE_SIZES.find((s) => String(s) === search.size) ?? DEFAULT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(search.page)) || 1));
  return { page, size, pages, skip: (page - 1) * size };
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 1, pages - 4));
  const to = Math.min(pages - 1, Math.max(page + 1, 5));
  const list: (number | "gap")[] = [1];
  if (from > 2) list.push("gap");
  for (let p = from; p <= to; p++) list.push(p);
  if (to < pages - 1) list.push("gap");
  list.push(pages);
  return list;
}

/**
 * Footer for admin lists: "Showing 21–40 of 132", numbered pages with
 * previous / next, and rows-per-page. `href` builds a link that keeps the
 * page's other filters.
 */
export function Pagination({
  page,
  pages,
  size,
  total,
  href,
  noun = "results",
}: {
  page: number;
  pages: number;
  size: number;
  total: number;
  href: (params: { page?: string; size?: string }) => string;
  noun?: string;
}) {
  if (total === 0) return null;
  const sizeParam = size === DEFAULT_PAGE_SIZE ? undefined : String(size);
  const link = (p: number) => href({ page: p > 1 ? String(p) : undefined, size: sizeParam });
  const first = (page - 1) * size + 1;
  const last = Math.min(total, page * size);

  const step = "flex h-8 w-8 items-center justify-center rounded-md border border-taupe/50 text-graphite transition-colors";

  return (
    <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 text-xs sm:flex-row">
      <div className="flex items-center gap-4 text-ash">
        <span>
          Showing <span className="text-ink">{first}–{last}</span> of <span className="text-ink">{total}</span> {noun}
        </span>
        <span className="flex items-center gap-1" aria-label="Rows per page">
          <span className="hidden sm:inline">Rows</span>
          {PAGE_SIZES.map((s) => (
            <Link
              key={s}
              href={href({ size: s === DEFAULT_PAGE_SIZE ? undefined : String(s) })}
              aria-current={s === size ? "true" : undefined}
              className={cx(
                "rounded-md px-2 py-1 transition-colors",
                s === size ? "bg-sand/50 text-ink" : "hover:bg-sand/20 hover:text-ink"
              )}
            >
              {s}
            </Link>
          ))}
        </span>
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={link(page - 1)} aria-label="Previous page" className={cx(step, "hover:border-ink hover:text-ink")}>
              <ChevronLeft size={15} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={cx(step, "opacity-40")}>
              <ChevronLeft size={15} strokeWidth={1.5} />
            </span>
          )}
          {pageList(page, pages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap${i}`} className="w-6 text-center text-ash">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={link(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cx(
                  "flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 transition-colors",
                  p === page ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30 hover:text-ink"
                )}
              >
                {p}
              </Link>
            )
          )}
          {page < pages ? (
            <Link href={link(page + 1)} aria-label="Next page" className={cx(step, "hover:border-ink hover:text-ink")}>
              <ChevronRight size={15} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={cx(step, "opacity-40")}>
              <ChevronRight size={15} strokeWidth={1.5} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
