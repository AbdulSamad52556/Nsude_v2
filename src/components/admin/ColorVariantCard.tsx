"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ProductImage, Size } from "@/lib/types";
import { cx } from "@/lib/utils";
import { uploadImage, uploadImageFromUrl } from "./api";

/** Form-side colorway: numbers stay strings while being edited. */
export interface VariantDraft {
  key: string;
  /** Product code (e.g. "7K2Q"); absent until a new color is first saved. */
  code?: string;
  name: string;
  hex: string;
  images: ProductImage[];
  stock: string;
  unavailableSizes: Size[];
  /** Price for each size of this color, as typed (whole rupees). */
  sizePrices: Partial<Record<Size, string>>;
}

const inputClass =
  "h-11 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none";
const labelClass = "mb-2 block text-[11px] uppercase tracking-widest2 text-ash";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rust">{message}</p>;
}

interface Props {
  variant: VariantDraft;
  index: number;
  count: number;
  productName: string;
  /** Sizes the product is made in; each gets a price and availability. */
  sizes: Size[];
  /** Validation errors for this color, keyed by field (name, images, …). */
  errors: Record<string, string>;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  /** Reports uploads in flight so the form can hold off saving. */
  onUploading: (delta: number) => void;
}

export function ColorVariantCard({
  variant,
  index,
  count,
  productName,
  sizes,
  errors,
  onChange,
  onRemove,
  onMove,
  onUploading,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [addMode, setAddMode] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");

  /** Fill every size of this color with one price. */
  function applyBulkPrice() {
    if (!bulkPrice) return;
    onChange({ sizePrices: Object.fromEntries(sizes.map((s) => [s, bulkPrice])) });
    setBulkPrice("");
  }

  // Keep the latest images for appends from sequential async uploads.
  const imagesRef = useRef(variant.images);
  imagesRef.current = variant.images;

  const altFor = (n: number) =>
    [productName, variant.name].filter(Boolean).join(" — ") + `, view ${n}`;

  function track(delta: number) {
    setUploading((n) => n + delta);
    onUploading(delta);
  }

  function append(img: Omit<ProductImage, "alt">) {
    const images = [...imagesRef.current, { ...img, alt: altFor(imagesRef.current.length + 1) }];
    imagesRef.current = images;
    onChange({ images });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setImageError(null);
    const list = Array.from(files);
    track(list.length);
    for (const file of list) {
      try {
        append(await uploadImage(file, "products"));
      } catch (err) {
        setImageError(`${file.name}: ${(err as Error).message}`);
      } finally {
        track(-1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function addFromUrl() {
    const url = imageUrl.trim();
    setImageError(null);
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setImageError("Enter a full image URL starting with http:// or https://");
      return;
    }
    track(1);
    try {
      append(await uploadImageFromUrl(url, "products"));
      setImageUrl("");
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      track(-1);
    }
  }

  function moveImage(i: number, dir: -1 | 1) {
    const images = [...variant.images];
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    [images[i], images[j]] = [images[j], images[i]];
    onChange({ images });
  }

  const validHex = /^#[0-9a-fA-F]{6}$/.test(variant.hex);

  return (
    <div className="border border-graphite/15">
      {/* Header: swatch, name, hex, order, remove */}
      <div className="flex flex-wrap items-start gap-3 border-b border-graphite/10 bg-bone/40 p-4">
        <input
          type="color"
          aria-label={`Color ${index + 1} swatch`}
          value={validHex ? variant.hex : "#000000"}
          onChange={(e) => onChange({ hex: e.target.value })}
          className="h-11 w-11 shrink-0 cursor-pointer border border-graphite/20 bg-transparent p-1"
        />
        <div className="min-w-[160px] flex-1">
          <input
            aria-label={`Color ${index + 1} name`}
            placeholder="Color name, e.g. Black"
            className={inputClass}
            value={variant.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <FieldError message={errors.name} />
          <p className="mt-1.5 text-[11px] text-ash">
            {variant.code ? (
              <>
                Product code <span className="font-mono text-ink">{variant.code}</span> · /product/{variant.code}
              </>
            ) : (
              "Product code is assigned when you save"
            )}
          </p>
        </div>
        <div className="w-32">
          <input
            aria-label={`Color ${index + 1} hex`}
            className={cx(inputClass, "font-mono")}
            value={variant.hex}
            onChange={(e) => onChange({ hex: e.target.value })}
          />
          <FieldError message={errors.hex} />
        </div>
        <div className="flex items-center gap-1 pt-1.5">
          {index === 0 && (
            <span className="mr-1 bg-ink px-2 py-0.5 text-[10px] uppercase tracking-wide text-bone" title="Shown first in the shop and on the product page">
              Default
            </span>
          )}
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move color up" className="p-2 text-ash hover:text-ink disabled:opacity-30">
            <ArrowUp size={15} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move color down" className="p-2 text-ash hover:text-ink disabled:opacity-30">
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={count === 1}
            aria-label={`Remove ${variant.name || `color ${index + 1}`}`}
            className="p-2 text-ash hover:text-rust disabled:opacity-30"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Price & availability: one row per size, priced per color */}
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className={cx(labelClass, "mb-0")}>Price &amp; availability for {variant.name || "this color"}</p>
            <div className="flex items-center gap-2">
              <div className="flex h-9 items-center border border-graphite/20 focus-within:border-ink">
                <span className="pl-2.5 text-xs text-ash">₹</span>
                <input
                  inputMode="numeric"
                  aria-label={`Set one price for every size of ${variant.name || "this color"}`}
                  placeholder="Same price for all"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyBulkPrice();
                    }
                  }}
                  className="h-full w-32 bg-transparent px-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={applyBulkPrice}
                disabled={!bulkPrice}
                className="h-9 border border-ink px-3 text-[10px] uppercase tracking-widest2 text-ink hover:bg-ink hover:text-bone disabled:border-graphite/20 disabled:text-ash disabled:hover:bg-transparent"
              >
                Apply to all sizes
              </button>
            </div>
          </div>

          {sizes.length === 0 ? (
            <p className="border border-dashed border-graphite/20 p-3 text-xs text-ash">
              Choose the sizes this product is made in (under Sizes &amp; measurements) to set their prices.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest2 text-ash">
                    <th className="w-16 pb-2 text-left font-normal">Size</th>
                    <th className="pb-2 text-left font-normal">Price</th>
                    <th className="pb-2 text-left font-normal">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((s) => {
                    const soldOut = variant.unavailableSizes.includes(s);
                    const priceError = errors[`sizePrices.${s}`];
                    return (
                      <tr key={s} className="border-t border-graphite/10">
                        <td className="py-2 pr-3 text-xs font-medium uppercase tracking-wide">{s}</td>
                        <td className="py-2 pr-3">
                          <div
                            className={cx(
                              "flex h-10 w-40 items-center border focus-within:border-ink",
                              priceError ? "border-rust" : "border-graphite/20"
                            )}
                          >
                            <span className="pl-3 text-ash">₹</span>
                            <input
                              inputMode="numeric"
                              aria-label={`${variant.name || "This color"} price for size ${s}`}
                              placeholder="0"
                              value={variant.sizePrices[s] ?? ""}
                              onChange={(e) =>
                                onChange({
                                  sizePrices: { ...variant.sizePrices, [s]: e.target.value.replace(/[^\d]/g, "") },
                                })
                              }
                              className="h-full w-full bg-transparent px-2 focus:outline-none"
                            />
                          </div>
                          {priceError && <p className="mt-1 text-xs text-rust">{priceError}</p>}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!soldOut}
                            aria-label={`${variant.name || "This color"} size ${s} in stock`}
                            onClick={() =>
                              onChange({
                                unavailableSizes: soldOut
                                  ? variant.unavailableSizes.filter((x) => x !== s)
                                  : [...variant.unavailableSizes, s],
                              })
                            }
                            className={cx(
                              "flex h-8 items-center gap-2 border px-3 text-[10px] uppercase tracking-widest2",
                              soldOut ? "border-rust/40 text-rust" : "border-graphite/20 text-ink"
                            )}
                          >
                            <span className={cx("h-2 w-2 rounded-full", soldOut ? "bg-rust" : "bg-[#4b7a4b]")} />
                            {soldOut ? "Sold out" : "In stock"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <FieldError message={errors.unavailableSizes ?? errors.sizePrices} />

          <div className="mt-4 w-44">
            <label htmlFor={`stock-${variant.key}`} className={labelClass}>Stock of this color</label>
            <input
              id={`stock-${variant.key}`}
              inputMode="numeric"
              className={inputClass}
              value={variant.stock}
              onChange={(e) => onChange({ stock: e.target.value.replace(/[^\d]/g, "") })}
            />
            <FieldError message={errors.stock} />
          </div>
        </div>

        {/* Photos */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className={cx(labelClass, "mb-0")}>Photos of this color</p>
            <div role="radiogroup" aria-label="How to add photos" className="inline-flex border border-graphite/20">
              {(
                [
                  { key: "upload", label: "Upload file", icon: Upload },
                  { key: "url", label: "Paste URL", icon: LinkIcon },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={addMode === key}
                  onClick={() => {
                    setAddMode(key);
                    setImageError(null);
                  }}
                  className={cx(
                    "flex h-8 items-center gap-2 px-3 text-[10px] uppercase tracking-widest2 transition-colors",
                    addMode === key ? "bg-ink text-bone" : "text-ash hover:text-ink"
                  )}
                >
                  <Icon size={13} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {addMode === "url" && (
            <div className="mb-4 flex gap-2">
              <input
                type="url"
                inputMode="url"
                aria-label={`Image URL for ${variant.name || `color ${index + 1}`}`}
                placeholder="https://example.com/tee-black-front.jpg"
                className={inputClass}
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageError(null);
                }}
                // Enter adds the photo instead of submitting the whole form.
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFromUrl();
                  }
                }}
              />
              <button
                type="button"
                onClick={addFromUrl}
                disabled={uploading > 0 || !imageUrl.trim()}
                className="flex h-11 shrink-0 items-center gap-2 bg-ink px-5 text-xs uppercase tracking-widest2 text-bone hover:bg-graphite disabled:opacity-50"
              >
                {uploading > 0 ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {variant.images.map((img, i) => (
              <div key={img.publicId ?? img.src} className="flex flex-col gap-1.5">
                <div className="relative aspect-[4/5] overflow-hidden bg-bone">
                  <Image src={img.src} alt={img.alt} fill sizes="160px" className="object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 bg-ink px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-bone">
                      Main
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange({ images: variant.images.filter((_, j) => j !== i) })}
                    aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 bg-paper/90 p-1 text-ink hover:text-rust"
                  >
                    <X size={12} />
                  </button>
                </div>
                <input
                  aria-label={`Alt text for photo ${i + 1}`}
                  placeholder="Alt text"
                  className="h-8 w-full border border-graphite/20 bg-transparent px-2 text-[11px] focus:border-ink focus:outline-none"
                  value={img.alt}
                  onChange={(e) =>
                    onChange({ images: variant.images.map((m, j) => (j === i ? { ...m, alt: e.target.value } : m)) })
                  }
                />
                <div className="flex justify-between">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Move photo left" className="p-0.5 text-ash hover:text-ink disabled:opacity-30">
                    <ArrowLeft size={13} />
                  </button>
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === variant.images.length - 1} aria-label="Move photo right" className="p-0.5 text-ash hover:text-ink disabled:opacity-30">
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
            {addMode === "upload" && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading > 0}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border border-dashed border-graphite/30 text-[10px] uppercase tracking-widest2 text-ash hover:border-ink hover:text-ink disabled:opacity-60"
              >
                {uploading > 0 ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Uploading {uploading}…
                  </>
                ) : (
                  <>
                    <ImagePlus size={18} strokeWidth={1.5} />
                    Add photos
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <FieldError message={imageError ?? errors.images} />
        </div>

      </div>
    </div>
  );
}
