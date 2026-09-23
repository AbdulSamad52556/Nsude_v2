"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";
import { formatPrice } from "@/lib/utils";

const popularSearches = ["Core Tee", "Oversized", "Heavyweight", "Black", "Archive"];

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  fit: string;
  image: string | null;
}

export function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useUI();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSearch();
    }
    if (isSearchOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    if (!isSearchOpen) setQuery("");
  }, [isSearchOpen]);

  // Debounced server search; an in-flight request is aborted when the query
  // changes so a slow earlier response can't overwrite newer results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search NSUDE"
          className="fixed inset-0 z-[96] flex flex-col bg-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col bg-paper">
          <div className="mx-auto flex w-full max-w-content flex-1 flex-col overflow-y-auto px-6 pb-16 pt-24 md:px-10">
            <div className="flex items-start justify-between">
              <span className="text-xs uppercase tracking-widest2 text-ash">
                Search NSUDE
              </span>
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="text-ink transition-opacity hover:opacity-60"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-4 border-b border-graphite/30 pb-4">
              <Search size={22} strokeWidth={1.5} className="text-ash" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products, fits, colors..."
                className="w-full bg-transparent text-2xl font-light text-ink placeholder:text-ash focus:outline-none md:text-4xl"
              />
            </div>

            {!query.trim() && (
              <div className="mt-10">
                <p className="mb-4 text-xs uppercase tracking-widest2 text-ash">
                  Popular Searches
                </p>
                <div className="flex flex-wrap gap-3">
                  {popularSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="border border-graphite/20 px-4 py-2 text-xs uppercase tracking-wide text-graphite transition-colors hover:border-ink hover:text-ink"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query.trim() && (
              <div className="mt-10">
                <p className="mb-4 text-xs uppercase tracking-widest2 text-ash" aria-live="polite">
                  {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
                </p>
                <ul className="flex flex-col">
                  {results.map((product, i) => (
                    <motion.li
                      key={product.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                    >
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={closeSearch}
                        className="group flex items-center gap-5 border-b border-graphite/10 py-4"
                      >
                        <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-bone">
                          {product.image && (
                            <Image
                              src={product.image}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <h3 className="text-sm uppercase tracking-wide text-ink">
                              {product.name}
                            </h3>
                            <p className="mt-1 text-xs text-ash">
                              {product.fit} fit
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-ink">
                              {formatPrice(product.price)}
                            </span>
                            <ArrowUpRight
                              size={16}
                              strokeWidth={1.5}
                              className="text-ash transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                            />
                          </div>
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                  {!loading && results.length === 0 && (
                    <p className="py-8 text-sm text-graphite">
                      Nothing found for &ldquo;{query}&rdquo;. Try another search.
                    </p>
                  )}
                </ul>
              </div>
            )}
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
