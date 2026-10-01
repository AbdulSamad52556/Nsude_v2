"use client";

import { useState } from "react";
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

/** Options shown before "Show more". */
const VISIBLE_OPTIONS = 5;

/**
 * An option list that shows the first few options and a "Show more" link
 * for the rest. Selected options always stay visible, even when collapsed.
 */
function OptionList<T>({
  items,
  itemKey,
  isSelected,
  render,
}: {
  items: T[];
  itemKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  render: (item: T) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = items.length > VISIBLE_OPTIONS;
  const visible =
    expanded || !collapsible ? items : items.filter((item, i) => i < VISIBLE_OPTIONS || isSelected(item));
  const hiddenCount = items.length - visible.length;

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {visible.map((item) => (
          <li key={itemKey(item)}>{render(item)}</li>
        ))}
      </ul>
      {collapsible && (expanded || hiddenCount > 0) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-3 text-[11px] uppercase tracking-widest2 text-moss underline decoration-moss/40 underline-offset-4 hover:decoration-moss"
        >
          {expanded ? "Show less" : `Show more (+${hiddenCount})`}
        </button>
      )}
    </>
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
        <OptionList
          items={[null, ...CATEGORIES]}
          itemKey={(category) => category ?? "all"}
          isSelected={(category) => filters.category === category}
          render={(category) => {
            const on = filters.category === category;
            const n = category === null ? allCategories : facets.category[category] ?? 0;
            return (
              <label className="flex cursor-pointer items-center gap-3 text-sm text-graphite hover:text-ink">
                <span
                  className={cx(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    on ? "border-moss" : "border-graphite/30"
                  )}
                >
                  {on && <span className="h-2 w-2 rounded-full bg-moss" />}
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
            );
          }}
        />
      </Group>

      <Group title="Fit">
        <OptionList
          items={[...FITS]}
          itemKey={(fit) => fit}
          isSelected={(fit) => filters.fits.includes(fit)}
          render={(fit) => {
            const n = facets.fit[fit] ?? 0;
            const on = filters.fits.includes(fit);
            return (
              <label
                className={cx(
                  "flex cursor-pointer items-center gap-3 text-sm",
                  n === 0 && !on ? "text-mist" : "text-graphite hover:text-ink"
                )}
              >
                <span
                  className={cx(
                    "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                    on ? "border-moss bg-moss text-paper" : "border-graphite/30"
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
            );
          }}
        />
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
                  "h-10 rounded-md border text-xs uppercase tracking-wide transition-colors",
                  on
                    ? "border-moss bg-moss text-paper"
                    : "border-graphite/20 text-ink hover:border-moss disabled:border-graphite/10 disabled:text-mist disabled:hover:border-graphite/10"
                )}
              >
                {size}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Color">
        <OptionList
          items={facets.colors}
          itemKey={(c) => c.key}
          isSelected={(c) => filters.colors.includes(c.key)}
          render={(c) => {
            const on = filters.colors.includes(c.key);
            const n = c.count;
            return (
              <button
                type="button"
                aria-pressed={on}
                disabled={n === 0 && !on}
                onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.key) })}
                className="group flex w-full items-center gap-3 text-left text-sm text-graphite hover:text-ink disabled:text-mist"
              >
                {/* The selection ring sits inside this box (not outside it),
                    so the scrolling sidebar can't clip it. */}
                <span
                  className={cx(
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                    on ? "border-moss" : "border-transparent"
                  )}
                >
                  <span
                    className={cx(
                      "h-4 w-4 rounded-full border",
                      on ? "border-graphite/20" : "border-graphite/20 group-hover:border-graphite/50"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                </span>
                <span className={cx("flex-1 truncate", on && "text-ink")}>{c.name}</span>
                <span className="text-xs text-ash">{n}</span>
              </button>
            );
          }}
        />
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
                      on ? "border-moss" : "border-graphite/30"
                    )}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-moss" />}
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
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              filters.inStock ? "bg-moss" : "bg-graphite/20"
            )}
          >
            <span
              className={cx(
                "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm transition-transform",
                filters.inStock ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </Group>
    </div>
  );
}
