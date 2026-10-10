"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  BoxSelect,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import {
  customPrice,
  DESIGN_FONTS,
  MAX_BOXES_PER_SIDE,
  MAX_LAYERS_PER_SIDE,
  MOCKUP_ASPECT,
  PRINT_SIDES,
  PRINT_WIDTH,
  printLabel,
  SIDE_LABEL,
  sideFee,
  TEXT_COLORS,
  type CustomSettings,
  type DesignFont,
  type PrintArea,
  type PrintBox,
  type PrintSide,
} from "@/lib/custom";
import { MAX_LINE_QUANTITY } from "@/lib/checkout";
import type { Size } from "@/lib/types";
import { cx, formatPrice } from "@/lib/utils";

export interface DesignerColour {
  code: string;
  name: string;
  hex: string;
  /** Mockup photo per view (null: that view can't be printed). */
  views: Record<PrintSide, string | null>;
  stock: number;
  unavailable: Size[];
  /** Blank price for each size it's made in. */
  prices: Partial<Record<Size, number>>;
}

export interface DesignerBlank {
  id: string;
  name: string;
  fit: string;
  material: string;
  sizes: Size[];
  colours: DesignerColour[];
}

interface Base {
  id: string;
  /** The print area it sits in. */
  boxId: string;
  /** Centre, as a fraction of its print area. */
  x: number;
  y: number;
}
interface ImageLayer extends Base {
  type: "image";
  /** Width as a fraction of the print area's width. */
  w: number;
  /** Height ÷ width. */
  aspect: number;
  /** On this device (for drawing); `src` once uploaded. */
  localUrl: string;
  src: string | null;
  publicId: string | null;
  naturalWidth: number;
}
interface TextLayer extends Base {
  type: "text";
  text: string;
  font: DesignFont;
  color: string;
  /** Font size as a fraction of the print area's width. */
  size: number;
}
type Layer = ImageLayer | TextLayer;
type Layers = Record<PrintSide, Layer[]>;
type Boxes = Record<PrintSide, PrintBox[]>;
type Selection = { kind: "layer" | "box"; id: string } | null;

const newId = () => Math.random().toString(36).slice(2, 10);
const MAX_UPLOAD = 10 * 1024 * 1024;
const MIN_BOX_W = 0.06;
const MIN_BOX_H = 0.05;

/** Keep a print area inside the printable zone, at least a minimum size. */
function clampBox(b: PrintBox, zone: PrintArea): PrintBox {
  const w = Math.min(zone.w, Math.max(MIN_BOX_W, b.w));
  const h = Math.min(zone.h, Math.max(MIN_BOX_H, b.h));
  return {
    ...b,
    w,
    h,
    x: Math.min(zone.x + zone.w - w, Math.max(zone.x, b.x)),
    y: Math.min(zone.y + zone.h - h, Math.max(zone.y, b.y)),
  };
}

/** The print area each side starts with: a large centre block. */
function startingBox(zone: PrintArea): PrintBox {
  const w = zone.w * 0.75;
  const h = Math.min(zone.h * 0.7, (w * 4) / 5 * 1.25);
  return { id: newId(), x: zone.x + (zone.w - w) / 2, y: zone.y + zone.h * 0.08, w, h };
}

/** Dark shirt → light text by default, and vice versa. */
function isDark(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load an image"));
    img.src = src;
  });
}

/** Same-origin copy of a remote photo (via the image optimiser), so the
    canvas can export it. */
const proxied = (url: string) => `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=90`;

async function uploadFile(file: Blob, name: string) {
  const body = new FormData();
  body.append("file", file, name);
  const res = await fetch("/api/custom/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data as { url: string; publicId: string; width: number; height: number };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't render the design"))), type, quality)
  );

export function CustomDesigner({
  blanks,
  settings,
  fontFamilies,
}: {
  blanks: DesignerBlank[];
  settings: CustomSettings;
  /** CSS font-family per font option. */
  fontFamilies: Record<DesignFont, string>;
}) {
  const { addCustomItem } = useCart();
  const [blankId, setBlankId] = useState(blanks[0].id);
  const blank = blanks.find((b) => b.id === blankId) ?? blanks[0];
  const [code, setCode] = useState(blank.colours[0].code);
  const colour = blank.colours.find((c) => c.code === code) ?? blank.colours[0];
  const [side, setSide] = useState<PrintSide>("front");
  // Sides start empty: the customer places their own print areas.
  const [boxes, setBoxes] = useState<Boxes>({ front: [], back: [], left: [], right: [] });
  const [layers, setLayers] = useState<Layers>({ front: [], back: [], left: [], right: [] });
  const [selection, setSelection] = useState<Selection>(null);
  const [draggingBox, setDraggingBox] = useState(false);
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const probes = useRef<Partial<Record<DesignFont, HTMLSpanElement | null>>>({});

  /** Where print areas may go on this side (the shirt, not the background). */
  const zone = settings.areas[side];
  const mockup = colour.views[side];
  const sideBoxes = boxes[side];
  const sideLayers = layers[side];
  const selected = selection?.kind === "layer" ? selection.id : null;
  const current = sideLayers.find((l) => l.id === selected) ?? null;
  // The area new images / text go into: the selected one, else the first.
  const activeBoxId =
    (current?.boxId ?? (selection?.kind === "box" ? selection.id : null)) ??
    sideBoxes[0]?.id ??
    null;
  const activeBox = sideBoxes.find((b) => b.id === activeBoxId) ?? null;
  const usedSides = PRINT_SIDES.filter((s) => layers[s].length > 0);
  const setSelected = (id: string | null) => setSelection(id ? { kind: "layer", id } : null);

  // A view this colour has no photo for can't be printed.
  useEffect(() => {
    if (!colour.views[side]) setSide("front");
  }, [colour.views, side]);
  // Keep the chosen size only if this tee / colour has it.
  useEffect(() => {
    if (size && (!blank.sizes.includes(size) || colour.unavailable.includes(size))) setSize(null);
  }, [blank, colour, size]);
  useEffect(() => setAdded(false), [layers, boxes, code, size, quantity]);

  const update = useCallback((id: string, patch: Partial<ImageLayer> | Partial<TextLayer>) => {
    setLayers((prev) => ({
      ...prev,
      [side]: prev[side].map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
    }));
  }, [side]);

  const remove = useCallback((id: string) => {
    setLayers((prev) => ({ ...prev, [side]: prev[side].filter((l) => l.id !== id) }));
    setSelection(null);
  }, [side]);

  const updateBox = useCallback((id: string, patch: Partial<PrintBox>) => {
    setBoxes((prev) => ({
      ...prev,
      [side]: prev[side].map((b) => (b.id === id ? clampBox({ ...b, ...patch }, settings.areas[side]) : b)),
    }));
  }, [side, settings.areas]);

  // ---- print areas -----------------------------------------------------------------

  /** A new area: the first is a large centre block; later ones are smaller
      (e.g. a chest logo), placed beside the others. */
  function addBox() {
    if (sideBoxes.length >= MAX_BOXES_PER_SIDE) return;
    if (sideBoxes.length === 0) {
      const first = startingBox(zone);
      setBoxes((prev) => ({ ...prev, [side]: [first] }));
      setSelection({ kind: "box", id: first.id });
      return;
    }
    const w = zone.w * 0.32;
    const h = (w * 4) / 5; // square on the shirt
    const n = sideBoxes.length - 1;
    const box = clampBox(
      { id: newId(), x: zone.x + (n % 2 === 1 ? zone.w - w : 0), y: zone.y + Math.floor(n / 2) * h * 1.1, w, h },
      zone
    );
    setBoxes((prev) => ({ ...prev, [side]: [...prev[side], box] }));
    setSelection({ kind: "box", id: box.id });
  }

  function removeBox(id: string) {
    setBoxes((prev) => ({ ...prev, [side]: prev[side].filter((b) => b.id !== id) }));
    setLayers((prev) => ({ ...prev, [side]: prev[side].filter((l) => l.boxId !== id) }));
    setSelection(null);
  }

  /** Images / text go into the active area (the buttons need one). */
  function targetBox(): PrintBox | null {
    return activeBox;
  }

  // ---- adding -----------------------------------------------------------------

  function addText() {
    const box = targetBox();
    if (!box || sideLayers.length >= MAX_LAYERS_PER_SIDE) return;
    const inBox = sideLayers.filter((l) => l.boxId === box.id).length;
    const layer: TextLayer = {
      id: newId(),
      boxId: box.id,
      type: "text",
      text: "Your text",
      font: "archivo",
      color: isDark(colour.hex) ? "#f8f6f1" : "#0a0a0a",
      size: 0.14,
      x: 0.5,
      y: Math.min(0.85, 0.3 + inBox * 0.18),
    };
    setLayers((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelected(layer.id);
  }

  async function addImage(files: FileList | null) {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Use a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setError("Images must be 10 MB or smaller.");
      return;
    }
    if (sideLayers.length >= MAX_LAYERS_PER_SIDE) return;
    const localUrl = URL.createObjectURL(file);
    const img = await loadImage(localUrl).catch(() => null);
    if (!img) {
      setError("That image couldn't be opened.");
      return;
    }
    const box = targetBox();
    if (!box) return;
    const aspect = img.naturalHeight / img.naturalWidth;
    const boxAspect = (box.h * 5) / (box.w * 4); // height ÷ width of the area on the shirt
    // Fit inside 85% of the area.
    const w = Math.min(0.85, (0.85 * boxAspect) / aspect);
    const layer: ImageLayer = {
      id: newId(),
      boxId: box.id,
      type: "image",
      x: 0.5,
      y: 0.5,
      w,
      aspect,
      localUrl,
      src: null,
      publicId: null,
      naturalWidth: img.naturalWidth,
    };
    const targetSide = side;
    setLayers((prev) => ({ ...prev, [targetSide]: [...prev[targetSide], layer] }));
    setSelected(layer.id);
    setUploading(true);
    try {
      const up = await uploadFile(file, file.name);
      setLayers((prev) => ({
        ...prev,
        [targetSide]: prev[targetSide].map((l) => (l.id === layer.id ? { ...l, src: up.url, publicId: up.publicId } : l)),
      }));
    } catch (err) {
      setError((err as Error).message);
      setLayers((prev) => ({ ...prev, [targetSide]: prev[targetSide].filter((l) => l.id !== layer.id) }));
    } finally {
      setUploading(false);
    }
  }

  // ---- moving & resizing --------------------------------------------------------

  const gesture = useRef<
    | { mode: "move"; id: string; startX: number; startY: number; x: number; y: number }
    | { mode: "scale"; id: string; cx: number; cy: number; dist: number; value: number }
    | { mode: "boxMove"; id: string; startX: number; startY: number; x: number; y: number }
    | { mode: "boxSize"; id: string; startX: number; startY: number; w: number; h: number }
    | null
  >(null);

  const boxRect = (id: string) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-box="${id}"]`)?.getBoundingClientRect() ?? null;

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const g = gesture.current;
      if (!g) return;
      if (g.mode === "boxMove" || g.mode === "boxSize") {
        const stage = stageRef.current?.getBoundingClientRect();
        if (!stage) return;
        const dx = (e.clientX - g.startX) / stage.width;
        const dy = (e.clientY - g.startY) / stage.height;
        if (g.mode === "boxMove") updateBox(g.id, { x: g.x + dx, y: g.y + dy });
        else updateBox(g.id, { w: g.w + dx, h: g.h + dy });
        return;
      }
      const layer = layers[side].find((l) => l.id === g.id);
      const rect = layer ? boxRect(layer.boxId) : null;
      if (!layer || !rect) return;
      if (g.mode === "move") {
        update(g.id, {
          x: Math.min(1.2, Math.max(-0.2, g.x + (e.clientX - g.startX) / rect.width)),
          y: Math.min(1.2, Math.max(-0.2, g.y + (e.clientY - g.startY) / rect.height)),
        });
      } else {
        const ratio = Math.hypot(e.clientX - g.cx, e.clientY - g.cy) / g.dist;
        if (layer.type === "image") update(g.id, { w: Math.min(2, Math.max(0.05, g.value * ratio)) });
        else update(g.id, { size: Math.min(0.8, Math.max(0.03, g.value * ratio)) });
      }
    }
    function onUp() {
      gesture.current = null;
      setDraggingBox(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update, updateBox, layers, side]);

  function startMove(e: React.PointerEvent, layer: Layer) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(layer.id);
    gesture.current = { mode: "move", id: layer.id, startX: e.clientX, startY: e.clientY, x: layer.x, y: layer.y };
  }

  function startScale(e: React.PointerEvent, layer: Layer) {
    e.preventDefault();
    e.stopPropagation();
    const rect = boxRect(layer.boxId);
    if (!rect) return;
    const cx = rect.left + layer.x * rect.width;
    const cy = rect.top + layer.y * rect.height;
    gesture.current = {
      mode: "scale",
      id: layer.id,
      cx,
      cy,
      dist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
      value: layer.type === "image" ? layer.w : layer.size,
    };
  }

  function startBoxMove(e: React.PointerEvent, box: PrintBox) {
    e.preventDefault();
    e.stopPropagation();
    setSelection({ kind: "box", id: box.id });
    setDraggingBox(true);
    gesture.current = { mode: "boxMove", id: box.id, startX: e.clientX, startY: e.clientY, x: box.x, y: box.y };
  }

  function startBoxSize(e: React.PointerEvent, box: PrintBox) {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(true);
    gesture.current = { mode: "boxSize", id: box.id, startX: e.clientX, startY: e.clientY, w: box.w, h: box.h };
  }

  // Keyboard: Delete removes, arrows nudge the selected layer or area.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selection) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const box = selection.kind === "box" ? boxes[side].find((b) => b.id === selection.id) : null;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (current) remove(current.id);
        else if (box) removeBox(box.id);
      }
      const step = e.shiftKey ? 0.05 : 0.01;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        if (current) update(current.id, { x: current.x + moves[e.key][0], y: current.y + moves[e.key][1] });
        else if (box) updateBox(box.id, { x: box.x + moves[e.key][0] / 2, y: box.y + moves[e.key][1] / 2 });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, current, boxes, side, remove, update, updateBox]);

  // ---- price ---------------------------------------------------------------------

  const basePrice = size ? colour.prices[size] ?? 0 : Math.min(...Object.values(colour.prices).filter((n): n is number => typeof n === "number"));
  const unitPrice = customPrice(basePrice, usedSides, settings);
  const soldOut = colour.stock <= 0;

  // ---- rendering the design (preview + print file) -------------------------------

  const fontFor = (font: DesignFont) => {
    const el = probes.current[font];
    return el ? getComputedStyle(el).fontFamily : "sans-serif";
  };

  async function drawLayers(
    ctx: CanvasRenderingContext2D,
    list: Layer[],
    box: { x: number; y: number; w: number; h: number }
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    for (const l of list) {
      const cx = box.x + l.x * box.w;
      const cy = box.y + l.y * box.h;
      if (l.type === "image") {
        const img = await loadImage(l.localUrl);
        const w = l.w * box.w;
        const h = w * l.aspect;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      } else {
        const meta = DESIGN_FONTS.find((f) => f.key === l.font)!;
        const family = fontFor(l.font);
        const px = l.size * box.w;
        await document.fonts.load(`${meta.weight} ${Math.round(px)}px ${family}`).catch(() => null);
        ctx.font = `${meta.weight} ${px}px ${family}`;
        ctx.fillStyle = l.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(l.text, cx, cy);
      }
    }
    ctx.restore();
  }

  /** Print areas on this side that have something in them. */
  const filledBoxes = (s: PrintSide) => boxes[s].filter((b) => layers[s].some((l) => l.boxId === b.id));

  async function renderSide(s: PrintSide) {
    const z: PrintArea = settings.areas[s];
    const photo = colour.views[s]!;
    const used = filledBoxes(s);
    // Preview: the shirt (cropped to 4:5 like on screen) with the design.
    const PW = 1000;
    const PH = PW / MOCKUP_ASPECT;
    const preview = document.createElement("canvas");
    preview.width = PW;
    preview.height = PH;
    const pctx = preview.getContext("2d")!;
    const shirt = await loadImage(proxied(photo));
    const k = Math.max(PW / shirt.naturalWidth, PH / shirt.naturalHeight);
    const dw = shirt.naturalWidth * k;
    const dh = shirt.naturalHeight * k;
    pctx.drawImage(shirt, (PW - dw) / 2, (PH - dh) / 2, dw, dh);
    for (const b of used) {
      await drawLayers(pctx, layers[s].filter((l) => l.boxId === b.id), { x: b.x * PW, y: b.y * PH, w: b.w * PW, h: b.h * PH });
    }

    // Print file: the whole printable zone, transparent, at print size, with
    // every area's design in its place on the shirt.
    const print = document.createElement("canvas");
    print.width = PRINT_WIDTH;
    print.height = Math.round(PRINT_WIDTH * ((z.h * PH) / (z.w * PW)));
    const pr = print.getContext("2d")!;
    for (const b of used) {
      await drawLayers(pr, layers[s].filter((l) => l.boxId === b.id), {
        x: ((b.x - z.x) / z.w) * print.width,
        y: ((b.y - z.y) / z.h) * print.height,
        w: (b.w / z.w) * print.width,
        h: (b.h / z.h) * print.height,
      });
    }

    return { preview: await toBlob(preview, "image/jpeg", 0.88), print: await toBlob(print, "image/png") };
  }

  async function addToBag() {
    setError(null);
    if (!size) {
      setError("Choose a size.");
      return;
    }
    if (usedSides.length === 0) {
      setError("Add an image or text to the front or back first.");
      return;
    }
    const missing = usedSides.find((s) => !colour.views[s]);
    if (missing) {
      setError(`This colour can't be printed on the ${missing}. Remove that design or pick another colour.`);
      return;
    }
    setSelection(null);
    try {
      setBusy("Preparing your design…");
      // Draw every side first, then upload all the files at once.
      const rendered: { side: PrintSide; preview: Blob; print: Blob }[] = [];
      for (const side of usedSides) rendered.push({ side, ...(await renderSide(side)) });
      setBusy("Saving your design…");
      const sides = await Promise.all(
        rendered.map(async (r) => {
          const [preview, print] = await Promise.all([
            uploadFile(r.preview, `${r.side}-preview.jpg`),
            uploadFile(r.print, `${r.side}-print.png`),
          ]);
          return {
            side: r.side,
            preview: { url: preview.url, publicId: preview.publicId },
            print: { url: print.url, publicId: print.publicId },
            boxes: filledBoxes(r.side).map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
            layers: layers[r.side].map((l) =>
              l.type === "image"
                ? { id: l.id, boxId: l.boxId, type: "image" as const, x: l.x, y: l.y, w: l.w, aspect: l.aspect, src: l.src! }
                : { id: l.id, boxId: l.boxId, type: "text" as const, x: l.x, y: l.y, text: l.text, font: l.font, color: l.color, size: l.size }
            ),
          };
        })
      );
      setBusy("Adding to your bag…");
      const assetIds = usedSides.flatMap((s) => layers[s].flatMap((l) => (l.type === "image" && l.publicId ? [l.publicId] : [])));
      const res = await fetch("/api/custom/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: colour.code, sides, assetIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your design");
      addCustomItem(
        {
          productId: blank.id,
          name: `Custom ${blank.name}`,
          code: colour.code,
          color: colour.name,
          size,
          price: unitPrice,
          image: data.preview,
          designId: data.id,
          design: printLabel(usedSides),
        },
        quantity
      );
      setAdded(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // ---- UI --------------------------------------------------------------------------

  const imageWarning =
    current?.type === "image" &&
    current.naturalWidth < PRINT_WIDTH * current.w * ((sideBoxes.find((b) => b.id === current.boxId)?.w ?? zone.w) / zone.w) * 0.5
      ? "This image is small for its size on the shirt and may print blurry. Use a larger image or make it smaller."
      : null;

  const priceRows = useMemo(
    () => [
      { label: `${blank.name}${size ? ` · ${size}` : ""}`, value: basePrice },
      ...usedSides.map((s) => ({ label: `${SIDE_LABEL[s]} print`, value: sideFee(settings, s) })),
    ],
    [blank.name, size, basePrice, usedSides, settings]
  );

  const boxNumber = (id: string) => sideBoxes.findIndex((b) => b.id === id) + 1;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
      {/* Hidden font probes: give the canvas the real font names. */}
      <div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
        {DESIGN_FONTS.map((f) => (
          <span key={f.key} ref={(el) => { probes.current[f.key] = el; }} style={{ fontFamily: fontFamilies[f.key], fontWeight: f.weight }}>
            Aa
          </span>
        ))}
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex rounded-md border border-taupe/50 p-0.5">
            {PRINT_SIDES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!colour.views[s]}
                onClick={() => {
                  setSide(s);
                  setSelection(null);
                }}
                className={cx(
                  "rounded px-3 py-2 text-[11px] uppercase tracking-widest2 transition-colors disabled:opacity-40 sm:px-4",
                  side === s ? "bg-ink text-paper" : "text-graphite hover:bg-sand/30"
                )}
              >
                {s}
                {layers[s].length > 0 && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
              </button>
            ))}
          </div>
          {/* Phones: the colour shows above the swatches instead. */}
          <p className="hidden text-[11px] uppercase tracking-widest2 text-ash sm:block">{colour.name}</p>
        </div>

        <div
          ref={stageRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[560px] select-none overflow-hidden rounded-md bg-bone"
          onPointerDown={() => setSelection(null)}
        >
          {mockup && <Image src={mockup} alt={`${blank.name} in ${colour.name}, ${side}`} fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />}

          {/* While an area is dragged: where areas are allowed to go. */}
          {draggingBox && (
            <div
              className="pointer-events-none absolute border border-dotted border-ink/30 bg-ink/[0.03]"
              style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%` }}
            />
          )}

          {sideBoxes.map((b, i) => {
            const active = b.id === activeBoxId && selection !== null;
            const boxLayers = sideLayers.filter((l) => l.boxId === b.id);
            return (
              <div
                key={b.id}
                data-box={b.id}
                onPointerDown={(e) => startBoxMove(e, b)}
                className={cx(
                  "absolute cursor-move touch-none [container-type:inline-size]",
                  active ? "border border-ink" : "border border-dashed border-ash/70 hover:border-ink/60"
                )}
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
              >
                {boxLayers.length === 0 && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] uppercase tracking-widest2 text-ash">
                    {sideBoxes.length > 1 ? `Area ${i + 1}` : "Print area"}
                  </p>
                )}
                {/* Anything outside its area is cut off when printed. */}
                <div className="absolute inset-0 overflow-hidden">
                  {boxLayers.map((l) => (
                    <div
                      key={l.id}
                      data-layer={l.id}
                      role="button"
                      tabIndex={0}
                      aria-label={l.type === "text" ? `Text: ${l.text}` : "Image"}
                      onPointerDown={(e) => startMove(e, l)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none"
                      style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: l.type === "image" ? `${l.w * 100}%` : undefined }}
                    >
                      {l.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.localUrl} alt="" draggable={false} className="pointer-events-none block w-full" />
                      ) : (
                        <span
                          className="pointer-events-none block whitespace-nowrap leading-none"
                          style={{
                            fontFamily: fontFamilies[l.font],
                            fontWeight: DESIGN_FONTS.find((f) => f.key === l.font)!.weight,
                            fontSize: `${l.size * 100}cqw`,
                            color: l.color,
                          }}
                        >
                          {l.text}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Selected layer: outline + handles (outside the clip). */}
                {current && current.boxId === b.id && (
                  <SelectionFrame layer={current} onScale={(e) => startScale(e, current)} onRemove={() => remove(current.id)} />
                )}
                {/* Selected area: its label, remove button and resize handle. */}
                {selection?.kind === "box" && selection.id === b.id && (
                  <>
                    <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap bg-ink px-1.5 py-0.5 text-[9px] uppercase tracking-widest2 text-paper">
                      Area {i + 1}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        removeBox(b.id);
                      }}
                      aria-label={`Remove area ${i + 1}`}
                      className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"
                    >
                      <X size={12} />
                    </button>
                    <ResizeHandle onPointerDown={(e) => startBoxSize(e, b)} />
                  </>
                )}
              </div>
            );
          })}

          {sideBoxes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={addBox}
                className="rounded-md flex items-center gap-2 border border-dashed border-ink/60 bg-paper/85 px-5 py-3 text-xs uppercase tracking-widest2 text-ink backdrop-blur transition-colors hover:border-ink hover:bg-paper"
              >
                <BoxSelect size={16} strokeWidth={1.5} /> Add a print area to start
              </button>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-ink/70 py-2 text-[11px] uppercase tracking-widest2 text-paper">
              <Loader2 size={14} className="animate-spin" /> Uploading image…
            </div>
          )}
        </div>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-xs text-ash">
          Drag a print area to place it, pull its corner to resize · only what&rsquo;s inside an area is printed
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-8">
        {blanks.length > 1 && (
          <Group title="Tee">
            <div className="grid grid-cols-2 gap-2">
              {blanks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBlankId(b.id);
                    setCode(b.colours[0].code);
                  }}
                  className={cx(
                    "rounded-md border px-3 py-2.5 text-left text-xs transition-colors",
                    b.id === blank.id ? "border-ink bg-ink text-paper" : "border-taupe/50 text-graphite hover:border-ink"
                  )}
                >
                  <span className="block uppercase tracking-wide">{b.name}</span>
                  <span className={cx("block", b.id === blank.id ? "text-paper/60" : "text-ash")}>{b.fit} fit</span>
                </button>
              ))}
            </div>
          </Group>
        )}

        <Group title={`Colour · ${colour.name}`}>
          <div className="flex flex-wrap gap-2.5">
            {blank.colours.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCode(c.code)}
                aria-label={c.name}
                title={c.stock > 0 ? c.name : `${c.name} (sold out)`}
                className={cx(
                  "relative h-9 w-9 rounded-full border transition-shadow",
                  c.code === colour.code ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "border-taupe/60",
                  c.stock <= 0 && "opacity-40"
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </Group>

        <Group title={`Design · ${side}`}>
          <button
            type="button"
            onClick={addBox}
            disabled={sideBoxes.length >= MAX_BOXES_PER_SIDE}
            className={cx(
              "rounded-md mb-2 flex h-11 w-full items-center justify-center gap-2 border text-xs uppercase tracking-widest2 transition-colors disabled:opacity-40",
              sideBoxes.length === 0
                ? "border-ink bg-ink text-paper hover:bg-graphite"
                : "border-dashed border-ink/50 text-ink hover:border-ink hover:bg-sand/20"
            )}
          >
            <BoxSelect size={16} strokeWidth={1.5} /> Add print area
            <span className={sideBoxes.length === 0 ? "text-paper/60" : "text-ash"}>
              {sideBoxes.length}/{MAX_BOXES_PER_SIDE}
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!activeBox || uploading || sideLayers.length >= MAX_LAYERS_PER_SIDE}
              className="rounded-md flex h-12 items-center justify-center gap-2 border border-ink text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
            >
              <ImagePlus size={16} strokeWidth={1.5} /> Upload image
            </button>
            <button
              type="button"
              onClick={addText}
              disabled={!activeBox || sideLayers.length >= MAX_LAYERS_PER_SIDE}
              className="rounded-md flex h-12 items-center justify-center gap-2 border border-ink text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
            >
              <Type size={16} strokeWidth={1.5} /> Add text
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => addImage(e.target.files)} />
          <p className="mt-2 text-xs text-ash">
            {sideBoxes.length === 0 ? "Start by adding a print area, then drag it where you want the print. " : ""}
            {sideBoxes.length > 1 && activeBox ? `New images and text go into area ${boxNumber(activeBox.id)} (tap an area to choose). ` : ""}
            PNG with a transparent background prints best. Up to 10 MB.
          </p>

          {sideLayers.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-taupe/20 rounded-md border border-taupe/30">
              {sideLayers.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(l.id)}
                    className={cx("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm", l.id === selected ? "bg-sand/30" : "hover:bg-sand/15")}
                  >
                    {l.type === "image" ? <ImagePlus size={15} className="shrink-0 text-ash" /> : <Type size={15} className="shrink-0 text-ash" />}
                    <span className="min-w-0 flex-1 truncate">{l.type === "text" ? l.text : "Image"}</span>
                    {sideBoxes.length > 1 && <span className="shrink-0 text-[10px] uppercase tracking-widest2 text-ash">Area {boxNumber(l.boxId)}</span>}
                    {l.type === "image" && !l.src && <Loader2 size={14} className="animate-spin text-ash" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Selected layer */}
          {current && (
            <div className="mt-4 flex flex-col gap-4 rounded-md border border-ink/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest2 text-ink">{current.type === "text" ? "Text" : "Image"}</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => update(current.id, { x: 0.5 })} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] uppercase tracking-wide text-graphite hover:bg-sand/30">
                    <AlignCenter size={13} /> Centre
                  </button>
                  <button type="button" onClick={() => remove(current.id)} aria-label="Remove" className="rounded p-1.5 text-ash hover:text-rust">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {current.type === "text" ? (
                <>
                  <input
                    value={current.text}
                    maxLength={60}
                    onChange={(e) => update(current.id, { text: e.target.value })}
                    className="rounded-md h-11 w-full border border-taupe/50 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
                    aria-label="Text"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    {DESIGN_FONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => update(current.id, { font: f.key })}
                        className={cx(
                          "truncate rounded-md border px-2 py-2 text-sm transition-colors",
                          current.font === f.key ? "border-ink bg-ink text-paper" : "border-taupe/50 text-ink hover:border-ink"
                        )}
                        style={{ fontFamily: fontFamilies[f.key], fontWeight: f.weight }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update(current.id, { color: c })}
                        aria-label={`Colour ${c}`}
                        className={cx("h-7 w-7 rounded-full border border-taupe/60", current.color === c && "ring-2 ring-ink ring-offset-2 ring-offset-paper")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-taupe/60" title="Any colour">
                      <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
                      <input type="color" value={current.color} onChange={(e) => update(current.id, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  </div>
                  <SizeSlider
                    label="Text size"
                    value={current.size}
                    min={0.03}
                    max={0.6}
                    onChange={(v) => update(current.id, { size: v })}
                  />
                </>
              ) : (
                <>
                  <SizeSlider label="Image size" value={current.w} min={0.05} max={1.5} onChange={(v) => update(current.id, { w: v })} />
                  {imageWarning && <p className="text-xs text-rust">{imageWarning}</p>}
                </>
              )}
            </div>
          )}
        </Group>

        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {blank.sizes.map((s) => {
              const off = soldOut || colour.unavailable.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={off}
                  onClick={() => setSize(s)}
                  className={cx(
                    "rounded-md h-11 min-w-[52px] border px-3 text-xs uppercase tracking-widest2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through",
                    size === s ? "border-ink bg-ink text-paper" : "border-taupe/50 text-ink hover:border-ink"
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {soldOut && <p className="mt-2 text-xs text-rust">{colour.name} is sold out right now. Try another colour.</p>}
        </Group>

        <div className="rounded-md border border-taupe/40 p-5">
          <dl className="flex flex-col gap-2 text-sm">
            {priceRows.map((r) => (
              <div key={r.label} className="flex justify-between text-graphite">
                <dt>{r.label}</dt>
                <dd>{r.label.endsWith("print") ? `+ ${formatPrice(r.value)}` : `${size ? "" : "from "}${formatPrice(r.value)}`}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-taupe/30 pt-3 text-ink">
              <dt className="uppercase tracking-widest2 text-xs">Price per tee</dt>
              <dd className="font-medium">{formatPrice(unitPrice)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-3">
            <div className="flex h-12 items-center rounded-md border border-taupe/50">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Fewer" className="flex h-full w-10 items-center justify-center text-ink disabled:opacity-30" disabled={quantity <= 1}>
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, Math.min(colour.stock, q + 1)))}
                aria-label="More"
                className="flex h-full w-10 items-center justify-center text-ink disabled:opacity-30"
                disabled={quantity >= Math.min(MAX_LINE_QUANTITY, colour.stock)}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={addToBag}
              disabled={Boolean(busy) || uploading || soldOut}
              className="rounded-md flex h-12 flex-1 items-center justify-center gap-2 bg-ink px-4 text-xs uppercase tracking-widest2 text-paper transition-colors hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ash/50"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {busy}
                </>
              ) : (
                <>Add to bag · {formatPrice(unitPrice * quantity)}</>
              )}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-rust">{error}</p>}
          {added && !error && <p role="status" className="mt-3 text-xs text-graphite">Added to your bag. You can keep editing and add another.</p>}
          <p className="mt-4 text-xs text-ash">
            {blank.material ? `${blank.material} · ` : ""}
            {blank.fit} fit. Every custom tee is printed to order after we check your design.
          </p>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-normal uppercase tracking-widest2 text-ink" style={{ fontFamily: "inherit" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SizeSlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-ash">{label}</span>
      <input type="range" min={min} max={max} step={0.005} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink" />
    </label>
  );
}

/** Corner handle for resizing: a small square with a larger, invisible
    grab zone so it's easy to catch with a finger or a quick mouse. */
function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <span
      onPointerDown={onPointerDown}
      aria-hidden
      className="pointer-events-auto absolute -bottom-4 -right-4 flex h-8 w-8 cursor-nwse-resize touch-none items-center justify-center"
    >
      <span className="h-4 w-4 rounded-sm border-2 border-ink bg-paper" />
    </span>
  );
}

/** Outline + resize handle + remove button around the selected layer. */
function SelectionFrame({
  layer,
  onScale,
  onRemove,
}: {
  layer: Layer;
  onScale: (e: React.PointerEvent) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // Measure the layer as drawn (text width depends on its font), and again
  // whenever it changes size.
  useEffect(() => {
    const node = ref.current?.parentElement?.querySelector<HTMLElement>(`[data-layer="${layer.id}"]`);
    if (!node) return;
    const measure = () => setBox({ w: node.offsetWidth, h: node.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [layer]);

  if (!box) return <div ref={ref} />;
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border border-ink"
      style={{ left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: box.w + 8, height: box.h + 8 }}
    >
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove"
        className="pointer-events-auto absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"
      >
        <X size={12} />
      </button>
      <ResizeHandle onPointerDown={onScale} />
    </div>
  );
}
