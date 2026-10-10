"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { customSettingsSchema, PRINT_SIDES, SIDE_LABEL, type CustomSettings, type PrintArea, type PrintSide } from "@/lib/custom";
import { cx } from "@/lib/utils";
import { ApiError, apiFetch } from "./api";

const inputClass =
  "rounded-md h-11 w-full border border-taupe/50 bg-transparent px-3 text-sm focus:border-ink focus:outline-none";
const labelClass = "mb-2 block text-[11px] uppercase tracking-widest2 text-ash";

const AREA_FIELDS: { key: keyof PrintArea; label: string }[] = [
  { key: "x", label: "From left" },
  { key: "y", label: "From top" },
  { key: "w", label: "Width" },
  { key: "h", label: "Height" },
];

/** Custom-tee settings: on/off, print prices, and the printable zone
    on the mockup photos (previewed on the first blank). */
export function CustomSettingsForm({
  initial,
  mockups,
}: {
  initial: CustomSettings;
  /** First blank's front / back photos, for previewing the printable zone. */
  mockups: Record<PrintSide, string | null>;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [side, setSide] = useState<PrintSide>("front");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  const setArea = (key: keyof PrintArea, value: number) =>
    setS((prev) => ({ ...prev, areas: { ...prev.areas, [side]: { ...prev.areas[side], [key]: value / 100 } } }));

  async function save() {
    const parsed = customSettingsSchema.safeParse(s);
    if (!parsed.success) {
      setMessage({ ok: false, text: parsed.error.issues[0]?.message ?? "Check the values." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/api/admin/products/custom", { method: "PUT", body: JSON.stringify(parsed.data) });
      setMessage({ ok: true, text: "Saved. The designer uses these now." });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  const area = s.areas[side];
  const mockup = mockups[side];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-lg border border-taupe/30 p-5 md:p-6">
        <h2 className="mb-5 text-xs uppercase tracking-widest2">Prices</h2>
        <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-ink" />
          <span>
            Take custom orders
            <span className="block text-xs text-ash">Off: the designer page says custom printing is paused.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-5">
          {PRINT_SIDES.map((k) => (
            <div key={k}>
              <label htmlFor={`fee-${k}`} className={labelClass}>{SIDE_LABEL[k]} print (₹)</label>
              <input
                id={`fee-${k}`}
                type="number"
                min={0}
                className={inputClass}
                value={s.fees[k]}
                onChange={(e) => setS({ ...s, fees: { ...s.fees, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-graphite">
          Price of a custom tee = the blank&rsquo;s price for that size + these for each view with a design. Example: a
          ₹799 blank printed on the front and back costs ₹{(799 + s.fees.front + s.fees.back).toLocaleString("en-IN")}.
        </p>

        <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest2">Printable zone</h2>
        <p className="mb-4 text-xs text-graphite">
          Customers place, resize and add their own print areas; this is only the outer limit they stay inside (the
          shirt&rsquo;s body, not the background, neck or sleeves). Keep every blank&rsquo;s photos framed the same way
          so it fits them all.
        </p>
        <div className="mb-4 inline-flex rounded-md border border-taupe/50 p-0.5">
          {PRINT_SIDES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSide(k)}
              className={cx("rounded px-4 py-2 text-[11px] uppercase tracking-widest2", side === k ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30")}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {AREA_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labelClass}>
                {f.label} · {Math.round(area[f.key] * 100)}%
              </label>
              <input
                type="range"
                min={f.key === "w" || f.key === "h" ? 5 : 0}
                max={f.key === "w" || f.key === "h" ? 100 : 95}
                value={Math.round(area[f.key] * 100)}
                onChange={(e) => setArea(f.key, Number(e.target.value))}
                className="w-full accent-ink"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-taupe/30 p-5 md:p-6">
        <h2 className="mb-4 text-xs uppercase tracking-widest2">Preview · {side}</h2>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-sand/30">
          {mockup ? (
            <Image src={mockup} alt="" fill sizes="340px" className="object-cover" />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-ash">
              Add a blank tee with a {side} photo to preview here.
            </p>
          )}
          <div
            className="absolute border-2 border-dashed border-rust bg-rust/10"
            style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}
          />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-taupe/30 bg-paper/95 px-5 py-4 backdrop-blur md:-mx-10 md:px-10 lg:col-span-2">
        <p role="status" className={message && !message.ok ? "text-xs text-rust" : "flex items-center gap-1 text-xs text-graphite"}>
          {message?.ok && <Check size={14} />}
          {message?.text ?? (dirty ? "Unsaved changes" : "")}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-md flex h-11 items-center gap-2 bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Save settings
        </button>
      </div>
    </div>
  );
}
