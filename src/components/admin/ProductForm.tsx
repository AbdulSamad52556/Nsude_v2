"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { CATEGORIES, FITS, SIZES, type Product, type Size } from "@/lib/types";
import { fieldErrors, productInputSchema } from "@/lib/validation";
import { cx } from "@/lib/utils";
import { ApiError, apiFetch } from "./api";
import { ColorVariantCard, type VariantDraft } from "./ColorVariantCard";
import { DeleteProductButton } from "./DeleteProductButton";
import { Select } from "./Select";

type Measurement = Product["measurements"][number];

const emptyValues = (): Record<Size, string> => ({ S: "", M: "", L: "", XL: "", XXL: "" });
const defaultMeasurements = (): Measurement[] => [
  { label: "Shoulder", values: emptyValues() },
  { label: "Chest", values: emptyValues() },
  { label: "Length", values: emptyValues() },
];

// Form state keeps numbers as strings so inputs can be empty mid-edit.
interface FormState {
  name: string;
  compareAtPrice: string;
  description: string;
  story: string;
  /** Colorways; each has its own photos, stock and sold-out sizes. */
  variants: VariantDraft[];
  sizes: Size[];
  category: Product["category"];
  material: string;
  fit: Product["fit"];
  weight: string;
  featured: boolean;
  newArrival: boolean;
  measurements: Measurement[];
}

let variantKeySeq = 0;
const newVariantKey = () => `v${++variantKeySeq}`;

const blankVariant = (name = "", hex = "#0a0a0a"): VariantDraft => ({
  key: newVariantKey(),
  name,
  hex,
  images: [],
  stock: "0",
  unavailableSizes: [],
  sizePrices: {},
});

function toFormState(p?: Product): FormState {
  return {
    name: p?.name ?? "",
    compareAtPrice: p?.compareAtPrice ? String(p.compareAtPrice) : "",
    description: p?.description ?? "",
    story: p?.story ?? "",
    variants: p?.variants.length
      ? p.variants.map((v) => ({
          key: newVariantKey(),
          code: v.code,
          name: v.name,
          hex: v.hex,
          images: v.images,
          stock: String(v.stock),
          unavailableSizes: v.unavailableSizes,
          // Every size gets its price shown; sizes without their own price
          // (older products) start from the product price, ready to edit.
          sizePrices: Object.fromEntries(p.sizes.map((s) => [s, String(v.sizePrices[s] ?? p.price)])),
        }))
      : [blankVariant("Black")],
    sizes: p?.sizes ?? [...SIZES],
    category: p?.category ?? "T-Shirts",
    material: p?.material ?? "",
    fit: p?.fit ?? "Regular",
    weight: p?.weight ?? "",
    featured: p?.featured ?? false,
    newArrival: p?.newArrival ?? true,
    measurements: p?.measurements.length ? p.measurements : defaultMeasurements(),
  };
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

const inputClass =
  "h-11 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none";
const labelClass = "mb-2 block text-[11px] uppercase tracking-widest2 text-ash";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rust">{message}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-graphite/15 p-5 md:p-6">
      <h2 className="mb-5 text-xs uppercase tracking-widest2">{title}</h2>
      {children}
    </section>
  );
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ---- colors ----------------------------------------------------------
  const updateVariant = (key: string, patch: Partial<VariantDraft>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  function moveVariant(index: number, dir: -1 | 1) {
    setForm((f) => {
      const variants = [...f.variants];
      const j = index + dir;
      if (j < 0 || j >= variants.length) return f;
      [variants[index], variants[j]] = [variants[j], variants[index]];
      return { ...f, variants };
    });
  }

  function removeVariant(key: string) {
    const v = form.variants.find((x) => x.key === key);
    if (v?.images.length && !window.confirm(`Remove ${v.name || "this color"} and its ${v.images.length} photo(s)?`)) return;
    setForm((f) => ({ ...f, variants: f.variants.filter((x) => x.key !== key) }));
  }

  /** Errors for one color, keyed by field (e.g. "images"), from "variants.2.images". */
  const variantErrors = (index: number) => {
    const prefix = `variants.${index}.`;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(errors)) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length); // e.g. "images" or "sizePrices.M"
      out[rest] ??= v;
      out[rest.split(".")[0]] ??= v;
    }
    return out;
  };

  // ---- submit ----------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...form,
      compareAtPrice: form.compareAtPrice.trim() ? num(form.compareAtPrice) : null,
      variants: form.variants.map((v) => ({
        name: v.name,
        code: v.code,
        hex: v.hex,
        images: v.images,
        stock: num(v.stock),
        // Drop sold-out picks for sizes the product no longer offers.
        unavailableSizes: v.unavailableSizes.filter((s) => form.sizes.includes(s)),
        // Prices for the sizes this product is made in (blank ones are
        // left out so validation can flag them).
        sizePrices: Object.fromEntries(
          form.sizes.filter((s) => v.sizePrices[s]?.trim()).map((s) => [s, num(v.sizePrices[s]!)])
        ),
      })),
      measurements: form.measurements.filter((m) => m.label.trim()),
    };

    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/admin/products/${product!.id}`, {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        });
      } else {
        await apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(parsed.data) });
      }
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else {
        setFormError("Couldn't save. Check your connection and try again.");
      }
      setSaving(false);
    }
  }

  const err = (key: string) => errors[key];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Section title="Details">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className={labelClass}>Name</label>
                <input
                  id="name"
                  className={inputClass}
                  value={form.name}
                  placeholder="NSUDE CORE TEE"
                  onChange={(e) => set("name", e.target.value)}
                />
                <FieldError message={err("name")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelClass}>Description</label>
                <textarea
                  id="description"
                  rows={3}
                  className={cx(inputClass, "h-auto py-2.5")}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
                <FieldError message={err("description")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="story" className={labelClass}>Story (shown under Fabric &amp; Fit)</label>
                <textarea
                  id="story"
                  rows={3}
                  className={cx(inputClass, "h-auto py-2.5")}
                  value={form.story}
                  onChange={(e) => set("story", e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Colors">
            <p className="mb-4 text-xs text-graphite">
              Each color is listed as its own product card in the shop, with its own photos, stock and sold-out sizes.
              The first color is the default. Photos: the first is the main one, the second shows on hover. JPG, PNG,
              WebP or AVIF, up to 10 MB.
            </p>
            <div className="flex flex-col gap-4">
              {form.variants.map((v, i) => (
                <ColorVariantCard
                  key={v.key}
                  variant={v}
                  index={i}
                  count={form.variants.length}
                  productName={form.name}
                  sizes={form.sizes}
                  errors={variantErrors(i)}
                  onChange={(patch) => updateVariant(v.key, patch)}
                  onRemove={() => removeVariant(v.key)}
                  onMove={(dir) => moveVariant(i, dir)}
                  onUploading={(delta) => setUploading((n) => n + delta)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                // A new color starts with the first color's prices, ready to edit.
                set("variants", [...form.variants, { ...blankVariant("", "#8a8a84"), sizePrices: { ...form.variants[0]?.sizePrices } }])
              }
              disabled={form.variants.length >= 20}
              className="mt-4 flex h-11 items-center gap-2 border border-dashed border-graphite/30 px-5 text-xs uppercase tracking-widest2 text-ash hover:border-ink hover:text-ink disabled:opacity-40"
            >
              <Plus size={14} /> Add color
            </button>
            <FieldError message={err("variants")} />
          </Section>

          <Section title="Sizes & measurements">
            <fieldset className="mb-6">
              <legend className={labelClass}>Sizes this product is made in</legend>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => {
                  const on = form.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("sizes", on ? form.sizes.filter((x) => x !== s) : SIZES.filter((x) => x === s || form.sizes.includes(x)))}
                      className={cx("h-10 w-12 border text-xs", on ? "border-ink bg-ink text-bone" : "border-graphite/20 hover:border-ink")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ash">Mark sizes sold out per color in the Colors section above.</p>
              <FieldError message={err("sizes")} />
            </fieldset>

            <p className={labelClass}>Measurements (e.g. 38.5&quot;)</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr className="text-ash">
                    <th className="pb-2 text-left font-normal uppercase tracking-wide">Label</th>
                    {SIZES.map((s) => (
                      <th key={s} className="pb-2 text-left font-normal">{s}</th>
                    ))}
                    <th className="sr-only">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {form.measurements.map((m, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input
                          aria-label={`Measurement ${i + 1} label`}
                          className="h-9 w-full border border-graphite/20 bg-transparent px-2 focus:border-ink focus:outline-none"
                          value={m.label}
                          onChange={(e) => set("measurements", form.measurements.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        />
                      </td>
                      {SIZES.map((s) => (
                        <td key={s} className="py-1 pr-2">
                          <input
                            aria-label={`${m.label || "Measurement"} ${s}`}
                            className="h-9 w-full min-w-[56px] border border-graphite/20 bg-transparent px-2 focus:border-ink focus:outline-none"
                            value={m.values[s]}
                            onChange={(e) =>
                              set("measurements", form.measurements.map((x, j) => (j === i ? { ...x, values: { ...x.values, [s]: e.target.value } } : x)))
                            }
                          />
                        </td>
                      ))}
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() => set("measurements", form.measurements.filter((_, j) => j !== i))}
                          aria-label={`Remove ${m.label || "measurement"}`}
                          className="p-2 text-ash hover:text-rust"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => set("measurements", [...form.measurements, { label: "", values: emptyValues() }])}
              className="mt-3 flex items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
            >
              <Plus size={14} /> Add row
            </button>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              {/* Prices are set per color and size in the Colors section;
                  this panel only summarises them. */}
              <div className="col-span-2">
                <p className={labelClass}>Price</p>
                {(() => {
                  const all = form.variants
                    .flatMap((v) => form.sizes.map((s) => num(v.sizePrices[s] ?? "")))
                    .filter((n) => Number.isFinite(n) && n > 0);
                  if (all.length === 0) {
                    return <p className="text-sm text-ash">Set prices for each size in the Colors section.</p>;
                  }
                  const min = Math.min(...all);
                  const max = Math.max(...all);
                  return (
                    <p className="text-sm">
                      {min === max
                        ? `₹${min.toLocaleString("en-IN")}`
                        : `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`}
                      <span className="text-ash"> · set per color &amp; size in Colors</span>
                    </p>
                  );
                })()}
              </div>
              <div className="col-span-2">
                <label htmlFor="compare" className={labelClass}>Compare at (₹)</label>
                <input id="compare" inputMode="numeric" placeholder="Optional" className={inputClass} value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value.replace(/[^\d]/g, ""))} />
                <FieldError message={err("compareAtPrice")} />
              </div>
              <div className="col-span-2 border-t border-graphite/10 pt-4">
                <p className={labelClass}>Stock (set per color)</p>
                <p className="text-sm">
                  {form.variants.reduce((n, v) => n + (Number(v.stock) || 0), 0)} total
                  <span className="text-ash">
                    {" "}across {form.variants.length} color{form.variants.length === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            </div>
          </Section>

          <Section title="Organization">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="category" className={labelClass}>Category</label>
                <Select id="category" value={form.category} onChange={(e) => set("category", e.target.value as FormState["category"])}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="fit" className={labelClass}>Fit</label>
                <Select id="fit" value={form.fit} onChange={(e) => set("fit", e.target.value as FormState["fit"])}>
                  {FITS.map((f) => <option key={f}>{f}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="material" className={labelClass}>Material</label>
                <input id="material" placeholder="240gsm Heavyweight Cotton" className={inputClass} value={form.material} onChange={(e) => set("material", e.target.value)} />
              </div>
              <div>
                <label htmlFor="weight" className={labelClass}>Weight</label>
                <input id="weight" placeholder="240 GSM" className={inputClass} value={form.weight} onChange={(e) => set("weight", e.target.value)} />
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-ink" />
                Featured on the home page
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={form.newArrival} onChange={(e) => set("newArrival", e.target.checked)} className="h-4 w-4 accent-ink" />
                Mark as new arrival
              </label>
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-graphite/15 bg-paper/95 px-5 py-4 backdrop-blur md:-mx-10 md:px-10">
        <div className="min-h-[1rem] text-xs text-rust" role="alert">{formError}</div>
        <div className="flex gap-3">
          {isEdit && <DeleteProductButton id={product!.id} name={product!.name} redirectTo="/admin/products" variant="button" />}
          <Link href="/admin/products" className="flex h-11 items-center px-5 text-xs uppercase tracking-widest2 text-graphite hover:text-ink">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || uploading > 0}
            className="flex h-11 items-center gap-2 bg-ink px-6 text-xs uppercase tracking-widest2 text-bone hover:bg-graphite disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>
    </form>
  );
}
