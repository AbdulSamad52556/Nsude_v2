"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { categoryKey, type CollectionData } from "@/lib/types";
import { collectionInputSchema, fieldErrors } from "@/lib/validation";
import { cx } from "@/lib/utils";
import { ApiError, apiFetch, uploadImage } from "./api";
import { BannerCropper } from "./BannerCropper";
import { Dialog } from "./Dialog";

export interface CollectionProductOption {
  id: string;
  name: string;
  category: string;
  image: string | null;
}

const inputClass =
  "rounded-md h-11 w-full border border-taupe/50 bg-transparent px-3 text-sm focus:border-ink focus:outline-none";
const labelClass = "mb-2 block text-[11px] uppercase tracking-widest2 text-ash";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rust">{message}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-taupe/30 p-5 md:p-6">
      <h2 className="mb-5 text-xs uppercase tracking-widest2">{title}</h2>
      {children}
    </section>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-sand/25">
      {src && <Image src={src} alt="" fill sizes="44px" className="object-cover" />}
    </div>
  );
}

export function CollectionForm({
  collection,
  products,
}: {
  collection?: CollectionData;
  products: CollectionProductOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(collection);
  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  // New collections take their address from the name until it's edited by hand.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [tagline, setTagline] = useState(collection?.tagline ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [image, setImage] = useState(collection?.image ?? null);
  const [productIds, setProductIds] = useState<string[]>(collection?.productIds ?? []);
  const [active, setActive] = useState(collection?.active ?? false);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  // A picked photo waiting to be cropped.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const picked = productIds.filter((id) => byId.has(id));
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter(
      (p) => !productIds.includes(p.id) && words.every((w) => `${p.name} ${p.category}`.toLowerCase().includes(w))
    );
  }, [products, productIds, query]);

  function move(index: number, dir: -1 | 1) {
    setProductIds((list) => {
      const next = list.filter((id) => byId.has(id));
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setErrors((e) => ({ ...e, image: "Use a JPG, PNG, WebP or AVIF image" }));
      return;
    }
    setErrors((e) => ({ ...e, image: "" }));
    setCropFile(file);
  }

  async function uploadCropped(file: File) {
    setCropFile(null);
    setUploading(true);
    setErrors((e) => ({ ...e, image: "" }));
    try {
      const img = await uploadImage(file, "collections");
      setImage({ src: img.src, alt: "", publicId: img.publicId, width: img.width, height: img.height });
    } catch (err) {
      setErrors((e) => ({ ...e, image: (err as Error).message }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = collectionInputSchema.safeParse({
      name,
      slug,
      tagline,
      description,
      image: image ? { ...image, alt: name } : null,
      productIds: picked,
      active,
      // The home banner no longer features a single collection.
      featured: false,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/admin/products/collections/${collection!.id}`, { method: "PUT", body: JSON.stringify(parsed.data) });
      } else {
        await apiFetch("/api/admin/products/collections", { method: "POST", body: JSON.stringify(parsed.data) });
      }
      router.push("/admin/products/collections");
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

  async function handleDelete() {
    if (!collection) return;
    const ok = window.confirm(
      `Delete the "${collection.name}" collection?\n\nIts page goes away. The products themselves stay in the shop.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/products/collections/${collection.id}`, { method: "DELETE" });
      router.push("/admin/products/collections");
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Details">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelClass}>Name</label>
                <input
                  id="name"
                  className={inputClass}
                  value={name}
                  placeholder="Summer '26"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(categoryKey(e.target.value));
                  }}
                />
                <FieldError message={errors.name} />
              </div>
              <div>
                <label htmlFor="slug" className={labelClass}>Web address</label>
                <div className="flex h-11 items-center rounded-md border border-taupe/50 focus-within:border-ink">
                  <span className="pl-3 text-sm text-ash">/collections/</span>
                  <input
                    id="slug"
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm focus:outline-none"
                    value={slug}
                    placeholder="summer-26"
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                  />
                </div>
                <FieldError message={errors.slug} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="tagline" className={labelClass}>Tagline (optional)</label>
                <input
                  id="tagline"
                  className={inputClass}
                  value={tagline}
                  placeholder="Light layers for long days"
                  onChange={(e) => setTagline(e.target.value)}
                />
                <FieldError message={errors.tagline} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelClass}>Description (optional)</label>
                <textarea
                  id="description"
                  rows={3}
                  className={cx(inputClass, "h-auto py-2.5")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <FieldError message={errors.description} />
              </div>
            </div>
          </Section>

          <Section title={`Products (${picked.length})`}>
            <p className="mb-4 text-xs text-graphite">
              Shown in this order on the collection page, each in its default colour. A product can be in any number of
              collections.
            </p>
            {picked.length === 0 ? (
              <p className="mb-5 rounded-md border border-dashed border-taupe/50 p-5 text-center text-xs text-ash">
                No products yet. Add some from the list below.
              </p>
            ) : (
              <ol className="mb-5 flex flex-col divide-y divide-taupe/20 rounded-md border border-taupe/30">
                {picked.map((id, i) => {
                  const p = byId.get(id)!;
                  return (
                    <li key={id} className="flex items-center gap-3 p-2.5">
                      <span className="w-6 text-center text-[11px] text-ash">{i + 1}</span>
                      <Thumb src={p.image} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{p.name}</p>
                        <p className="text-xs text-ash">{p.category}</p>
                      </div>
                      <div className="flex shrink-0">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`} className="p-2 text-ash hover:text-ink disabled:opacity-30">
                          <ArrowUp size={15} />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label={`Move ${p.name} down`} className="p-2 text-ash hover:text-ink disabled:opacity-30">
                          <ArrowDown size={15} />
                        </button>
                        <button type="button" onClick={() => setProductIds((l) => l.filter((x) => x !== id))} aria-label={`Remove ${p.name}`} className="p-2 text-ash hover:text-rust">
                          <X size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <FieldError message={errors.productIds} />

            <label htmlFor="product-search" className={labelClass}>Add products</label>
            <div className="relative mb-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" />
              <input
                id="product-search"
                className={cx(inputClass, "pl-9")}
                value={query}
                placeholder="Search by name or category"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ul className="flex max-h-80 flex-col divide-y divide-taupe/20 overflow-y-auto rounded-md border border-taupe/30">
              {matches.length === 0 ? (
                <li className="p-4 text-center text-xs text-ash">
                  {products.length === picked.length ? "Every product is already in this collection." : "No products match."}
                </li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setProductIds((l) => [...l.filter((x) => byId.has(x)), p.id])}
                      className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-sand/20"
                    >
                      <Thumb src={p.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{p.name}</span>
                        <span className="block text-xs text-ash">{p.category}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 pr-1 text-[11px] uppercase tracking-widest2 text-graphite">
                        <Plus size={14} /> Add
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Banner photo">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="group relative flex aspect-[24/5] w-full items-center justify-center overflow-hidden rounded-md bg-sand/30"
              aria-label={image ? "Replace banner photo" : "Upload banner photo"}
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-graphite" />
              ) : image ? (
                <>
                  <Image src={image.src} alt="" fill sizes="380px" className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-[10px] uppercase tracking-wide text-paper opacity-0 transition-opacity group-hover:opacity-100">
                    Replace
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-2 text-[11px] uppercase tracking-widest2 text-ash">
                  <ImagePlus size={20} strokeWidth={1.5} />
                  Upload
                </span>
              )}
            </button>
            {image && (
              <button type="button" onClick={() => setImage(null)} className="mt-2 flex items-center gap-1 text-xs text-ash hover:text-rust">
                <Trash2 size={13} /> Remove photo
              </button>
            )}
            <FieldError message={errors.image} />
            <p className="mt-3 text-xs text-graphite">
              A full-width strip, 300px tall on the site. After picking a photo you choose the crop. JPG, PNG, WebP or
              AVIF, up to 10 MB. Without a banner, the collection shows its product photos instead.
            </p>
            <Dialog open={cropFile !== null} title="Crop banner" onClose={() => setCropFile(null)} wide>
              {cropFile && <BannerCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={uploadCropped} />}
            </Dialog>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => handleFile(e.target.files)} />
          </Section>

          <Section title="Visibility">
            <div className="flex flex-col gap-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ink"
                />
                <span>
                  Show on the site
                  <span className="block text-xs text-ash">Off = draft. Only you can see it here.</span>
                </span>
              </label>
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-taupe/30 bg-paper/95 px-5 py-4 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex items-center gap-4">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="flex items-center gap-2 text-xs uppercase tracking-widest2 text-rust hover:underline disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
            </button>
          )}
          <p role="status" className="text-xs text-rust">{formError}</p>
        </div>
        <button
          type="submit"
          disabled={saving || uploading || deleting}
          className="rounded-md flex h-11 items-center gap-2 bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {isEdit ? "Save collection" : "Create collection"}
        </button>
      </div>
    </form>
  );
}
