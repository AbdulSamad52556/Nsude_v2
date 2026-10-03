"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ChevronDown, Loader2, SlidersHorizontal, X } from "lucide-react";
import type { CardData } from "@/lib/types";
import type { ShopPage } from "@/lib/server/listings";
import { ProductGrid } from "@/components/product/ProductGrid";
import { cx } from "@/lib/utils";
import { FilterPanel } from "./FilterPanel";
import {
  EMPTY_FILTERS,
  PRICE_BANDS,
  SORT_OPTIONS,
  activeFilterCount,
  filtersToQuery,
  type Filters,
} from "./filters";

function SortMenu({ value, onChange }: { value: Filters["sort"]; onChange: (v: Filters["sort"]) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.key === value)!;
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or on a tap outside the menu. That outside tap only
  // closes it: the click it would cause (e.g. opening a product) is
  // swallowed. (No full-screen overlay — on desktop it sat above the
  // options and blocked them.)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      // A scroll or drag produces no click; don't leave the trap behind.
      window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 600);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 whitespace-nowrap text-xs uppercase tracking-widest2 text-ink"
      >
        <span className="text-ash">Sort:</span> {current.label}
        <ChevronDown size={13} strokeWidth={1.5} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
          <ul
            role="listbox"
            className="absolute right-0 top-full z-40 mt-3 w-56 border border-graphite/15 bg-paper py-2 shadow-lg"
          >
            {SORT_OPTIONS.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.key === value}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={cx(
                    "w-full px-4 py-2 text-left text-xs uppercase tracking-wide",
                    o.key === value ? "text-ink" : "text-ash hover:bg-bone hover:text-ink"
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
      )}
    </div>
  );
}

/**
 * The shop. Filtering, sorting, counting and paging all happen in the
 * database (see /api/listings); this component only holds the current
 * filters and the cards loaded so far. The server renders the first page,
 * so the initial HTML is complete and fast.
 */
export function ShopView({ initialFilters, initialPage }: { initialFilters: Filters; initialPage: ShopPage }) {
  const pathname = usePathname();

  // The filters are mirrored into the URL (replaceState: no navigation, no
  // server round trip) so a filtered view can be shared.
  const [filters, setLocalFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<ShopPage>(initialPage);
  const [cards, setCards] = useState<CardData[]>(initialPage.cards);
  const [loading, setLoading] = useState<"filter" | "more" | null>(null);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const fetchPage = useCallback(async (f: Filters, page: number) => {
    // Cancel any older request so a slow response can't overwrite newer ones.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const qs = filtersToQuery(f);
    const res = await fetch(`/api/listings?${qs}${qs ? "&" : ""}page=${page}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Shop request failed: ${res.status}`);
    return (await res.json()) as ShopPage;
  }, []);

  const setFilters = useCallback(
    (next: Filters) => {
      setLocalFilters(next);
      const qs = filtersToQuery(next);
      window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
      setLoading("filter");
      setError(false);
      setMoreError(false);
      fetchPage(next, 1)
        .then((page) => {
          setData(page);
          setCards(page.cards);
          setLoading(null);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setError(true);
          setLoading(null);
        });
    },
    [fetchPage, pathname]
  );

  const loadMore = useCallback(() => {
    setLoading("more");
    setMoreError(false);
    fetchPage(filters, data.page + 1)
      .then((page) => {
        setData(page);
        // Skip any card already shown (in case the catalog changed meanwhile).
        setCards((prev) => {
          const seen = new Set(prev.map((c) => c.code));
          return [...prev, ...page.cards.filter((c) => !seen.has(c.code))];
        });
        setLoading(null);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        // Stops auto-loading until the shopper taps "try again", so a
        // failing request isn't retried in a loop.
        setMoreError(true);
        setLoading(null);
      });
  }, [fetchPage, filters, data.page]);

  useEffect(() => () => inFlight.current?.abort(), []);

  // Infinite scroll: load the next page when the marker under the grid
  // nears the viewport. Re-armed after each load, so if the new cards still
  // don't fill the screen, the following page loads too.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !data.hasMore || loading !== null || moreError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          loadMore();
        }
      },
      { rootMargin: "0px 0px 600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [data.hasMore, loading, moreError, loadMore]);

  const total = data.total;
  const facets = data.facets;

  const activeCount = activeFilterCount(filters);
  const clearAll = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort });

  // Removable chips for every active filter.
  const chips: { label: string; remove: () => void }[] = [
    ...(filters.category
      ? [{ label: filters.category, remove: () => setFilters({ ...filters, category: null }) }]
      : []),
    ...filters.fits.map((fit) => ({
      label: fit,
      remove: () => setFilters({ ...filters, fits: filters.fits.filter((f) => f !== fit) }),
    })),
    ...filters.sizes.map((size) => ({
      label: `Size ${size}`,
      remove: () => setFilters({ ...filters, sizes: filters.sizes.filter((s) => s !== size) }),
    })),
    ...filters.colors.map((key) => ({
      label: facets.colors.find((c) => c.key === key)?.name ?? key,
      remove: () => setFilters({ ...filters, colors: filters.colors.filter((c) => c !== key) }),
    })),
    ...(filters.price
      ? [{ label: PRICE_BANDS.find((b) => b.key === filters.price)!.label, remove: () => setFilters({ ...filters, price: null }) }]
      : []),
    ...(filters.inStock ? [{ label: "In stock", remove: () => setFilters({ ...filters, inStock: false }) }] : []),
  ];
  const chipButtons = chips.map((chip) => (
    <button
      key={chip.label}
      type="button"
      onClick={chip.remove}
      aria-label={`Remove filter ${chip.label}`}
      className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap border border-graphite/20 px-3 text-xs uppercase tracking-wide text-ink hover:border-ink"
    >
      {chip.label}
      <X size={12} strokeWidth={1.5} />
    </button>
  ));


  // Mobile filter drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Phones / tablets: Sort + Filter live in a bar pinned to the bottom of
  // the screen; Sort opens a bottom sheet. Both are portalled to <body>.
  const [sortOpen, setSortOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Room at the end of the page so the bar never covers the footer.
  useEffect(() => {
    const cls = ["pb-[calc(56px+env(safe-area-inset-bottom))]", "lg:pb-0"];
    document.body.classList.add(...cls);
    return () => document.body.classList.remove(...cls);
  }, []);
  useEffect(() => {
    if (!sortOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSortOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sortOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="mx-auto max-w-content px-5 pb-24 pt-24 md:px-10 md:pt-32">
      {/* Compact header: just the breadcrumb */}
      {/* Breadcrumb on larger screens only. */}
      <nav aria-label="Breadcrumb" className="mb-4 hidden text-[11px] uppercase tracking-widest2 text-ash md:block">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Shop</span>
      </nav>
      {/* No visible heading or counts (by design); the title stays for
          screen readers and search engines. */}
      <h1 className="sr-only">{filters.category ?? "Shop all T-shirts"}</h1>

      <div className="grid grid-cols-1 gap-10 md:mt-8 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
        {/* Desktop: sticky filter sidebar */}
        <aside aria-label="Filters" className="hidden lg:block">
          {/* Scrolls on its own when taller than the screen; scrollbar hidden. */}
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest2 text-ink">Filters</p>
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="text-[11px] uppercase tracking-widest2 text-ash underline underline-offset-4 hover:text-ink">
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel facets={facets} filters={filters} onChange={setFilters} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* Desktop toolbar: active chips + sort. (Phones use the bottom bar.) */}
          <div className="mb-8 hidden items-center justify-between gap-4 lg:flex">
            <div className="flex flex-wrap items-center gap-2">{chipButtons}</div>
            <SortMenu value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
          </div>

          {/* Phones: active chips in one sideways-scrolling row. */}
          {chips.length > 0 && (
            <div className="-mx-5 mb-6 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-10 md:px-10 lg:hidden [&::-webkit-scrollbar]:hidden">
              {chipButtons}
              {chips.length > 1 && (
                <button type="button" onClick={clearAll} className="shrink-0 whitespace-nowrap px-1 text-[11px] uppercase tracking-widest2 text-ash underline underline-offset-4 hover:text-ink">
                  Clear all
                </button>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mb-6 border border-rust/30 p-3 text-sm text-rust">
              Couldn&apos;t load products. Check your connection and try again.
            </p>
          )}

          {/* Dim the current results while a filter change loads. */}
          <div
            aria-busy={loading === "filter"}
            className={cx("transition-opacity duration-300", loading === "filter" && "pointer-events-none opacity-40")}
          >
            {cards.length === 0 && loading !== "filter" ? (
              <div className="flex flex-col items-center gap-4 border border-dashed border-graphite/20 py-24 text-center">
                <p className="text-sm uppercase tracking-widest2 text-ash">No products match these filters</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="border-b border-ink pb-1 text-xs uppercase tracking-widest2 text-ink"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ProductGrid cards={cards} layout="shop" />
            )}
          </div>

          {/* Infinite scroll: this marker sits under the grid; when it comes
              within ~600px of the screen, the next page loads by itself. */}
          {data.hasMore && cards.length > 0 && (
            <div ref={sentinelRef} className="mt-12 flex h-16 items-center justify-center" aria-live="polite">
              {loading === "more" && (
                <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ash" aria-label="Loading more products" />
              )}
              {moreError && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreError(false);
                    loadMore();
                  }}
                  className="text-xs uppercase tracking-widest2 text-rust underline underline-offset-4"
                >
                  Couldn&apos;t load more — try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {mounted &&
        createPortal(
          <>
            {/* Phones / tablets: Filter | Sort pinned to the bottom. */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-graphite/10 bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
              <div className="grid h-14 grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-haspopup="dialog"
                  className="relative flex items-center justify-center gap-2 text-xs uppercase tracking-widest2 text-ink after:absolute after:right-0 after:top-1/2 after:h-6 after:w-px after:-translate-y-1/2 after:bg-graphite/15"
                >
                  <SlidersHorizontal size={15} strokeWidth={1.5} />
                  Filter{activeCount > 0 && ` (${activeCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => setSortOpen(true)}
                  aria-haspopup="dialog"
                  className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest2 text-ink"
                >
                  <ArrowDownUp size={15} strokeWidth={1.5} />
                  Sort
                  {filters.sort !== "featured" && <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-label="(changed)" />}
                </button>
              </div>
            </div>

            {/* Sort sheet */}
            <AnimatePresence>
              {sortOpen && (
                <div key="sort-sheet-root" className="fixed inset-0 z-[70] lg:hidden">
                  <motion.div
                    key="sort-backdrop"
                    className="absolute inset-0 bg-ink/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSortOpen(false)}
                    aria-hidden
                  />
                  <motion.div
                    key="sort-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sort by"
                    className="absolute inset-x-0 bottom-0 rounded-t-xl bg-paper pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-5"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="mb-2 px-5 text-xs uppercase tracking-widest2 text-ash">Sort by</p>
                    <ul role="listbox" aria-label="Sort by">
                      {SORT_OPTIONS.map((o) => {
                        const on = filters.sort === o.key;
                        return (
                          <li key={o.key}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={on}
                              onClick={() => {
                                setSortOpen(false);
                                if (!on) setFilters({ ...filters, sort: o.key });
                              }}
                              className={cx(
                                "flex w-full items-center justify-between px-5 py-3.5 text-left text-sm",
                                on ? "text-ink" : "text-graphite"
                              )}
                            >
                              {o.label}
                              <span
                                aria-hidden
                                className={cx(
                                  "flex h-4 w-4 items-center justify-center rounded-full border",
                                  on ? "border-moss" : "border-graphite/30"
                                )}
                              >
                                {on && <span className="h-2 w-2 rounded-full bg-moss" />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

      {/* Mobile / tablet: filter drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div className="fixed inset-0 z-[90] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-paper"
            >
              <div className="flex items-center justify-between border-b border-graphite/10 px-5 py-4">
                <p className="text-xs uppercase tracking-widest2 text-ink">Filters</p>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filters" className="text-ink">
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-6">
                <FilterPanel facets={facets} filters={filters} onChange={setFilters} />
              </div>
              <div className="border-t border-graphite/10 p-4">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={activeCount === 0}
                  className="h-10 w-full rounded-md border border-graphite/20 text-xs uppercase tracking-widest2 text-ink disabled:text-mist"
                >
                  Clear all
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
