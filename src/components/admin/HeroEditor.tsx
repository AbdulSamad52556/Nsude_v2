"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import type { HeroSlide } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { ApiError, apiFetch, uploadImage } from "./api";

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface DraftSlide {
  key: string;
  productId: string;
  image: { src: string; publicId?: string | null; width: number; height: number } | null;
}

const RECOMMENDED = 5;
const MAX = 10;
let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

export function HeroEditor({
  initialSlides,
  products,
}: {
  initialSlides: HeroSlide[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [slides, setSlides] = useState<DraftSlide[]>(() =>
    initialSlides.map((s) => ({ key: s.id, productId: s.product.id, image: s.image }))
  );
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const update = (key: string, patch: Partial<DraftSlide>) => {
    setSlides((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setDirty(true);
    setMessage(null);
  };

  function move(index: number, dir: -1 | 1) {
    setSlides((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  function pickImage(key: string) {
    uploadTarget.current = key;
    fileInput.current?.click();
  }

  async function handleFile(files: FileList | null) {
    const key = uploadTarget.current;
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!key || !file) return;
    setUploadingKey(key);
    setMessage(null);
    try {
      const img = await uploadImage(file, "hero");
      update(key, { image: img });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setUploadingKey(null);
    }
  }

  async function save() {
    const incomplete = slides.findIndex((s) => !s.image || !s.productId);
    if (incomplete !== -1) {
      setMessage({ type: "error", text: `Slide ${incomplete + 1} needs both an image and a product.` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/api/admin/hero", {
        method: "PUT",
        body: JSON.stringify({
          slides: slides.map((s) => ({ productId: s.productId, image: { ...s.image!, alt: "" } })),
        }),
      });
      setDirty(false);
      setMessage({ type: "ok", text: "Saved. The home page hero is updated." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof ApiError ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-graphite/15 bg-bone/50 p-4 text-sm text-graphite">
        Upload a <strong className="font-medium text-ink">transparent PNG cutout</strong> of each t-shirt (like the
        current ones), then pick the product it links to. Slides play in this order.
        {slides.length !== RECOMMENDED && (
          <> The carousel is designed around {RECOMMENDED} slides; you have {slides.length}.</>
        )}
      </div>

      {products.length === 0 && (
        <p className="text-sm text-rust">Create a product first. Every slide links to a product.</p>
      )}

      <ol className="flex flex-col gap-4">
        {slides.map((slide, i) => {
          const product = products.find((p) => p.id === slide.productId);
          return (
            <li key={slide.key} className="flex flex-col gap-4 border border-graphite/15 p-4 sm:flex-row sm:items-center">
              <span className="text-xs uppercase tracking-widest2 text-ash sm:w-8">{String(i + 1).padStart(2, "0")}</span>

              <button
                type="button"
                onClick={() => pickImage(slide.key)}
                disabled={uploadingKey !== null}
                className="group relative flex h-44 w-full shrink-0 items-center justify-center overflow-hidden bg-ink sm:w-36"
                aria-label={slide.image ? `Replace image for slide ${i + 1}` : `Upload image for slide ${i + 1}`}
              >
                {uploadingKey === slide.key ? (
                  <Loader2 size={20} className="animate-spin text-bone" />
                ) : slide.image ? (
                  <>
                    <Image
                      src={slide.image.src}
                      alt=""
                      width={slide.image.width}
                      height={slide.image.height}
                      className="h-full w-auto object-contain p-2"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[10px] uppercase tracking-wide text-bone opacity-0 transition-opacity group-hover:opacity-100">
                      Replace
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center gap-2 text-[11px] uppercase tracking-widest2 text-stone">
                    <ImagePlus size={20} strokeWidth={1.5} />
                    Upload
                  </span>
                )}
              </button>

              <div className="flex-1">
                <label htmlFor={`product-${slide.key}`} className="mb-2 block text-[11px] uppercase tracking-widest2 text-ash">
                  Links to product
                </label>
                <select
                  id={`product-${slide.key}`}
                  value={slide.productId}
                  onChange={(e) => update(slide.key, { productId: e.target.value })}
                  className="h-11 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {product && (
                  <p className="mt-2 text-xs text-ash">
                    Shown as &ldquo;{product.name}&rdquo; · {formatPrice(product.price)}
                  </p>
                )}
              </div>

              <div className="flex gap-1 sm:flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-2 text-ash hover:text-ink disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1} aria-label="Move down" className="p-2 text-ash hover:text-ink disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSlides((list) => list.filter((s) => s.key !== slide.key));
                    setDirty(true);
                  }}
                  aria-label={`Remove slide ${i + 1}`}
                  className="p-2 text-ash hover:text-rust"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => {
          const key = newKey();
          setSlides((list) => [...list, { key, productId: "", image: null }]);
          setDirty(true);
        }}
        disabled={slides.length >= MAX}
        className="flex w-fit items-center gap-2 text-xs uppercase tracking-widest2 text-ash hover:text-ink disabled:opacity-40"
      >
        <Plus size={14} /> Add slide
      </button>

      <input ref={fileInput} type="file" accept="image/png,image/webp,image/avif,image/jpeg" hidden onChange={(e) => handleFile(e.target.files)} />

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-graphite/15 bg-paper/95 px-5 py-4 backdrop-blur md:-mx-10 md:px-10">
        <p role="status" className={message?.type === "error" ? "text-xs text-rust" : "flex items-center gap-1 text-xs text-graphite"}>
          {message?.type === "ok" && <Check size={14} />}
          {message?.text ?? (dirty ? "Unsaved changes" : "")}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploadingKey !== null || !dirty}
          className="flex h-11 items-center gap-2 bg-ink px-6 text-xs uppercase tracking-widest2 text-bone hover:bg-graphite disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Save carousel
        </button>
      </div>
    </div>
  );
}
