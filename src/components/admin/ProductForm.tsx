"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { CATEGORIES, FITS, SIZES, type Product, type ProductImage, type Size } from "@/lib/types";
import { fieldErrors, productInputSchema, slugify } from "@/lib/validation";
import { cx } from "@/lib/utils";
import { ApiError, apiFetch, uploadImage } from "./api";
import { DeleteProductButton } from "./DeleteProductButton";

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
  slug: string;
  price: string;
  compareAtPrice: string;
  description: string;
  story: string;
  images: ProductImage[];
  colors: { name: string; hex: string }[];
  sizes: Size[];
  unavailableSizes: Size[];
  category: Product["category"];
  material: string;
  fit: Product["fit"];
  weight: string;
  stock: string;
  featured: boolean;
  newArrival: boolean;
  measurements: Measurement[];
}

function toFormState(p?: Product): FormState {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    price: p ? String(p.price) : "",
    compareAtPrice: p?.compareAtPrice ? String(p.compareAtPrice) : "",
    description: p?.description ?? "",
    story: p?.story ?? "",
    images: p?.images ?? [],
    colors: p?.colors.length ? p.colors : [{ name: "Black", hex: "#0a0a0a" }],
    sizes: p?.sizes ?? [...SIZES],
    unavailableSizes: p?.unavailableSizes ?? [],
    category: p?.category ?? "T-Shirts",
    material: p?.material ?? "",
    fit: p?.fit ?? "Regular",
    weight: p?.weight ?? "",
    stock: p ? String(p.stock) : "0",
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
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ---- images ----------------------------------------------------------
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setFormError(null);
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const img = await uploadImage(file, "products");
        setForm((f) => ({
          ...f,
          images: [...f.images, { ...img, alt: f.name ? `${f.name}, view ${f.images.length + 1}` : "" }],
        }));
      } catch (err) {
        setFormError(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function moveImage(index: number, dir: -1 | 1) {
    setForm((f) => {
      const images = [...f.images];
      const target = index + dir;
      if (target < 0 || target >= images.length) return f;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...f, images };
    });
  }

  // ---- submit ----------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...form,
      price: num(form.price),
      compareAtPrice: form.compareAtPrice.trim() ? num(form.compareAtPrice) : null,
      stock: num(form.stock),
      unavailableSizes: form.unavailableSizes.filter((s) => form.sizes.includes(s)),
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
              <div>
                <label htmlFor="name" className={labelClass}>Name</label>
                <input
                  id="name"
                  className={inputClass}
                  value={form.name}
                  placeholder="NSUDE CORE TEE"
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name.replace(/^nsude\s+/i, "")) }));
                  }}
                />
                <FieldError message={err("name")} />
              </div>
              <div>
                <label htmlFor="slug" className={labelClass}>URL slug</label>
                <div className="flex items-center border border-graphite/20 focus-within:border-ink">
                  <span className="pl-3 text-sm text-ash">/product/</span>
                  <input
                    id="slug"
                    className="h-11 w-full bg-transparent pr-3 text-sm focus:outline-none"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                  />
                </div>
                <FieldError message={err("slug")} />
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

          <Section title="Images">
            <p className="mb-4 text-xs text-graphite">
              The first image is the main one; the second shows on hover in the shop. JPG, PNG, WebP or AVIF, up to 10 MB.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {form.images.map((img, i) => (
                <div key={img.publicId ?? img.src} className="flex flex-col gap-2">
                  <div className="relative aspect-[4/5] overflow-hidden bg-bone">
                    <Image src={img.src} alt={img.alt} fill sizes="200px" className="object-cover" />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 bg-ink px-2 py-0.5 text-[10px] uppercase tracking-wide text-bone">
                        Main
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                      aria-label="Remove image"
                      className="absolute right-2 top-2 bg-paper/90 p-1 text-ink hover:text-rust"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    aria-label={`Alt text for image ${i + 1}`}
                    placeholder="Alt text"
                    className="h-9 w-full border border-graphite/20 bg-transparent px-2 text-xs focus:border-ink focus:outline-none"
                    value={img.alt}
                    onChange={(e) =>
                      set("images", form.images.map((m, j) => (j === i ? { ...m, alt: e.target.value } : m)))
                    }
                  />
                  <div className="flex justify-between">
                    <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Move left" className="p-1 text-ash hover:text-ink disabled:opacity-30">
                      <ArrowLeft size={14} />
                    </button>
                    <button type="button" onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1} aria-label="Move right" className="p-1 text-ash hover:text-ink disabled:opacity-30">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading > 0}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border border-dashed border-graphite/30 text-xs uppercase tracking-widest2 text-ash hover:border-ink hover:text-ink disabled:opacity-60"
              >
                {uploading > 0 ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading {uploading}…
                  </>
                ) : (
                  <>
                    <ImagePlus size={20} strokeWidth={1.5} />
                    Add images
                  </>
                )}
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <FieldError message={err("images")} />
          </Section>

          <Section title="Colors">
            <div className="flex flex-col gap-3">
              {form.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={`Color ${i + 1} swatch`}
                    value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"}
                    onChange={(e) => set("colors", form.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                    className="h-11 w-11 shrink-0 cursor-pointer border border-graphite/20 bg-transparent p-1"
                  />
                  <input
                    aria-label={`Color ${i + 1} name`}
                    placeholder="Name"
                    className={inputClass}
                    value={c.name}
                    onChange={(e) => set("colors", form.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    aria-label={`Color ${i + 1} hex`}
                    className={cx(inputClass, "w-32 shrink-0 font-mono")}
                    value={c.hex}
                    onChange={(e) => set("colors", form.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => set("colors", form.colors.filter((_, j) => j !== i))}
                    disabled={form.colors.length === 1}
                    aria-label={`Remove color ${i + 1}`}
                    className="p-2 text-ash hover:text-rust disabled:opacity-30"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("colors", [...form.colors, { name: "", hex: "#8a8a84" }])}
                className="flex w-fit items-center gap-1 text-xs uppercase tracking-widest2 text-ash hover:text-ink"
              >
                <Plus size={14} /> Add color
              </button>
            </div>
            <FieldError message={err("colors") ?? Object.entries(errors).find(([k]) => k.startsWith("colors."))?.[1]} />
          </Section>

          <Section title="Sizes & measurements">
            <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <fieldset>
                <legend className={labelClass}>Offered sizes</legend>
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
                <FieldError message={err("sizes")} />
              </fieldset>
              <fieldset>
                <legend className={labelClass}>Sold out sizes</legend>
                <div className="flex flex-wrap gap-2">
                  {form.sizes.map((s) => {
                    const on = form.unavailableSizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("unavailableSizes", on ? form.unavailableSizes.filter((x) => x !== s) : [...form.unavailableSizes, s])}
                        className={cx("h-10 w-12 border text-xs", on ? "border-rust bg-rust text-bone line-through" : "border-graphite/20 hover:border-ink")}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={err("unavailableSizes")} />
              </fieldset>
            </div>

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
          <Section title="Pricing & stock">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className={labelClass}>Price (₹)</label>
                <input id="price" inputMode="numeric" className={inputClass} value={form.price} onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))} />
                <FieldError message={err("price")} />
              </div>
              <div>
                <label htmlFor="compare" className={labelClass}>Compare at (₹)</label>
                <input id="compare" inputMode="numeric" placeholder="Optional" className={inputClass} value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value.replace(/[^\d]/g, ""))} />
                <FieldError message={err("compareAtPrice")} />
              </div>
              <div className="col-span-2">
                <label htmlFor="stock" className={labelClass}>Stock</label>
                <input id="stock" inputMode="numeric" className={inputClass} value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/[^\d]/g, ""))} />
                <FieldError message={err("stock")} />
              </div>
            </div>
          </Section>

          <Section title="Organization">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="category" className={labelClass}>Category</label>
                <select id="category" className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value as FormState["category"])}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fit" className={labelClass}>Fit</label>
                <select id="fit" className={inputClass} value={form.fit} onChange={(e) => set("fit", e.target.value as FormState["fit"])}>
                  {FITS.map((f) => <option key={f}>{f}</option>)}
                </select>
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
