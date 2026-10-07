"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { COLLECTION_BANNER } from "@/lib/types";

const { width: OUT_W, height: OUT_H } = COLLECTION_BANNER;
const ASPECT = OUT_W / OUT_H;
/** On a phone the strip is about 375 × 250, so only the middle of the
    banner shows; that part is outlined while cropping. */
const PHONE_SHARE = 375 / (250 * ASPECT);
const MAX_ZOOM = 4;

/**
 * Pick the part of a photo to use as a collection banner: drag to move,
 * zoom with the slider (or scroll). Produces a 1920 × 400 JPEG.
 */
export function BannerCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (cropped: File) => void | Promise<void>;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  // Centre of the crop, as a fraction of the photo's width / height.
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameH = frameW / ASPECT;
  const natW = img?.naturalWidth ?? 1;
  const natH = img?.naturalHeight ?? 1;
  // Smallest scale that still fills the frame, times the zoom.
  const scale = Math.max(frameW / natW, frameH / natH) * zoom;
  const dispW = natW * scale;
  const dispH = natH * scale;

  /** Keep the crop inside the photo. */
  function clamp(c: { x: number; y: number }, z = zoom) {
    const s = Math.max(frameW / natW, frameH / natH) * z;
    const halfX = frameW / (natW * s) / 2;
    const halfY = frameH / (natH * s) / 2;
    return {
      x: Math.min(1 - halfX, Math.max(halfX, c.x)),
      y: Math.min(1 - halfY, Math.max(halfY, c.y)),
    };
  }

  function setZoomClamped(z: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setCenter((c) => clamp(c, next));
  }

  // Re-fit when the frame resizes.
  useEffect(() => {
    if (img && frameW) setCenter((c) => clamp(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, frameW]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setCenter(clamp({ x: d.cx - (e.clientX - d.x) / dispW, y: d.cy - (e.clientY - d.y) / dispH }));
  }
  const endDrag = () => {
    drag.current = null;
  };

  async function finish() {
    if (!img) return;
    setBusy(true);
    const srcW = (frameW / dispW) * natW;
    const srcH = (frameH / dispH) * natH;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, center.x * natW - srcW / 2, center.y * natH - srcH / 2, srcW, srcH, 0, 0, OUT_W, OUT_H);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) {
      setBusy(false);
      return;
    }
    await onDone(new File([blob], "collection-banner.jpg", { type: "image/jpeg" }));
    setBusy(false);
  }

  // How much of the photo's real width ends up in the 1920px banner.
  const sourceWidth = img ? Math.round((frameW / dispW) * natW) : OUT_W;
  const soft = img !== null && frameW > 0 && sourceWidth < OUT_W * 0.6;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-graphite">
        Drag the photo to choose what shows. The whole strip shows on computers; on phones, only the outlined middle part.
      </p>

      <div
        ref={frame}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-md bg-ink active:cursor-grabbing"
        style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(e) => setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {url && img && frameW > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none"
            style={{
              width: dispW,
              height: dispH,
              transform: `translate(${frameW / 2 - center.x * dispW}px, ${frameH / 2 - center.y * dispH}px)`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-paper" />
          </div>
        )}
        {/* What a phone shows. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-x border-dashed border-paper/80"
          style={{ width: `${PHONE_SHARE * 100}%` }}
        >
          <span className="absolute left-1.5 top-1.5 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
            Phone
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setZoomClamped(zoom / 1.2)} aria-label="Zoom out" className="p-1 text-ash hover:text-ink">
          <Minus size={16} />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoomClamped(Number(e.target.value))}
          aria-label="Zoom"
          className="flex-1 accent-ink"
        />
        <button type="button" onClick={() => setZoomClamped(zoom * 1.2)} aria-label="Zoom in" className="p-1 text-ash hover:text-ink">
          <Plus size={16} />
        </button>
      </div>
      {soft && <p className="text-xs text-rust">This part of the photo is small, so the banner may look soft. Zoom out or use a larger photo.</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="h-11 px-5 text-xs uppercase tracking-widest2 text-graphite hover:text-ink">
          Cancel
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={busy || !img}
          className="rounded-md flex h-11 items-center gap-2 bg-ink px-6 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Use this crop
        </button>
      </div>
    </div>
  );
}
