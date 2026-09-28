"use client";

import { Check } from "lucide-react";
import { CATEGORIES, FITS, SIZES } from "@/lib/types";
import type { ShopFacets } from "@/lib/server/listings";
import { cx } from "@/lib/utils";
import { PRICE_BANDS, type Filters } from "./filters";

interface Props {
  /** Option counts from the server for the current filters. */
  facets: ShopFacets;
  filters: Filters;
  onChange: (next: Filters) => void;
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `filter-${title.toLowerCase()}`;
  return (
    // A plain labelled group (not fieldset/legend, whose legend cuts into
    // the divider line).
    <div role="group" aria-labelledby={id} className="border-t border-graphite/10 py-6 first:border-t-0 first:pt-0">
      <p id={id} className="mb-4 text-[11px] uppercase tracking-widest2 text-ink">{title}</p>
      {children}
    </div>
  );
}

/**
 * Filter controls shared by the desktop sidebar and the mobile drawer.
 * Each option shows how many colorways it would leave, given every *other*
 * active filter (so counts never read 0 just because of the same group).
 * The counts are computed in the database and arrive with each result page.
 */
export function FilterPanel({ facets, filters, onChange }: Props) {
  const allCategories = Object.values(facets.category).reduce((a, b) => a + b, 0);

  return (
    <div>
      <Group title="Category">
        <ul className="flex flex-col gap-2.5">
          {[null, ...CATEGORIES].map((category) => {
            const on = filters.category === category;
            const n = category === null ? allCategories : facets.category[category] ?? 0;
            return (
              <li key={category ?? "all"}>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-graphite hover:text-ink">
                  <span
                    className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      on ? "border-ink" : "border-graphite/30"
                    )}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-ink" />}
                  </span>
                  <input
                    type="radio"
                    name="shop-category"
                    className="sr-only"
                    checked={on}
                    onChange={() => onChange({ ...filters, category })}
                  />
                  <span className={cx("flex-1", on && "text-ink")}>{category ?? "All"}</span>
                  <span className="text-xs text-ash">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Fit">
        <ul className="flex flex-col gap-2.5">
          {FITS.map((fit) => {
            const n = facets.fit[fit] ?? 0;
            const on = filters.fits.includes(fit);
            return (
              <li key={fit}>
                <label
                  className={cx(
                    "flex cursor-pointer items-center gap-3 text-sm",
                    n === 0 && !on ? "text-mist" : "text-graphite hover:text-ink"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                      on ? "border-ink bg-ink text-bone" : "border-graphite/30"
                    )}
                  >
                    {on && <Check size={11} strokeWidth={2.5} />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={n === 0 && !on}
                    onChange={() => onChange({ ...filters, fits: toggle(filters.fits, fit) })}
                  />
                  <span className={cx("flex-1", on && "text-ink")}>{fit}</span>
                  <span className="text-xs text-ash">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Size">
        <div className="grid grid-cols-5 gap-1.5">
          {SIZES.map((size) => {
            const on = filters.sizes.includes(size);
            const n = facets.size[size] ?? 0;
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                disabled={n === 0 && !on}
                onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, size) })}
                className={cx(
                  "h-10 border text-xs uppercase tracking-wide transition-colors",
                  on
                    ? "border-ink bg-ink text-bone"
                    : "border-graphite/20 text-ink hover:border-ink disabled:border-graphite/10 disabled:text-mist disabled:hover:border-graphite/10"
                )}
              >
                {size}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Color">
        <ul className="flex flex-col gap-2.5">
          {facets.colors.map((c) => {
            const on = filters.colors.includes(c.key);
            const n = c.count;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={n === 0 && !on}
                  onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.key) })}
                  className="group flex w-full items-center gap-3 text-left text-sm text-graphite hover:text-ink disabled:text-mist"
                >
                  <span
                    className={cx(
                      "h-4 w-4 shrink-0 rounded-full border transition-shadow",
                      on
                        ? "border-ink ring-1 ring-ink ring-offset-2 ring-offset-paper"
                        : "border-graphite/20 group-hover:border-graphite/50"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className={cx("flex-1 truncate", on && "text-ink")}>{c.name}</span>
                  <span className="text-xs text-ash">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Price">
        <ul className="flex flex-col gap-2.5">
          {PRICE_BANDS.map((band) => {
            const on = filters.price === band.key;
            const n = facets.price[band.key] ?? 0;
            return (
              <li key={band.key}>
                <label
                  className={cx(
                    "flex cursor-pointer items-center gap-3 text-sm",
                    n === 0 && !on ? "text-mist" : "text-graphite hover:text-ink"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      on ? "border-ink" : "border-graphite/30"
                    )}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-ink" />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={n === 0 && !on}
                    // Click the selected band again to clear it.
                    onChange={() => onChange({ ...filters, price: on ? null : band.key })}
                  />
                  <span className={cx("flex-1", on && "text-ink")}>{band.label}</span>
                  <span className="text-xs text-ash">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Availability">
        <button
          type="button"
          role="switch"
          aria-checked={filters.inStock}
          onClick={() => onChange({ ...filters, inStock: !filters.inStock })}
          className="flex w-full items-center justify-between text-sm text-graphite hover:text-ink"
        >
          In stock only
          <span
            className={cx(
              "relative h-5 w-9 rounded-full transition-colors",
              filters.inStock ? "bg-ink" : "bg-graphite/20"
            )}
          >
            <span
              className={cx(
                "absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-transform",
                filters.inStock ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </Group>
    </div>
  );
}
