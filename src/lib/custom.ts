// Custom T-shirts: rules shared by the designer (browser), the admin
// settings and the server, so all agree on prices, print areas and what a
// valid design looks like.
import { z } from "zod";

/** The views of a blank that can be printed. Each colour's photos are, in
    order: front, back, left, right. */
export const PRINT_SIDES = ["front", "back", "left", "right"] as const;
export type PrintSide = (typeof PRINT_SIDES)[number];

export const SIDE_LABEL: Record<PrintSide, string> = { front: "Front", back: "Back", left: "Left", right: "Right" };

/** Each side's mockup photo: the colour's photos in order. */
export const sidePhoto = (images: { src: string }[], side: PrintSide) => images[PRINT_SIDES.indexOf(side)]?.src ?? null;

/** A rectangle as fractions of the mockup photo (4:5). */
export interface PrintArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CustomSettings {
  /** Customers can order custom tees. */
  enabled: boolean;
  /** Added to the blank tee's price for each printed side (₹). */
  fees: Record<PrintSide, number>;
  /** Printable zone per side: the outer limit for customers' print areas
      (the shirt itself, not the background). */
  areas: Record<PrintSide, PrintArea>;
}

export const DEFAULT_CUSTOM_SETTINGS: CustomSettings = {
  enabled: true,
  fees: { front: 299, back: 299, left: 149, right: 149 },
  areas: {
    front: { x: 0.24, y: 0.2, w: 0.52, h: 0.6 },
    back: { x: 0.24, y: 0.16, w: 0.52, h: 0.66 },
    left: { x: 0.25, y: 0.18, w: 0.5, h: 0.62 },
    right: { x: 0.25, y: 0.18, w: 0.5, h: 0.62 },
  },
};

const fraction = z.number().min(0).max(1);
const areaSchema = z
  .object({ x: fraction, y: fraction, w: z.number().min(0.05).max(1), h: z.number().min(0.05).max(1) })
  .refine((a) => a.x + a.w <= 1.0001 && a.y + a.h <= 1.0001, "The print area must fit inside the photo");

const fee = z.number().int().min(0).max(100000);

export const customSettingsSchema = z.object({
  enabled: z.boolean(),
  fees: z.object({ front: fee, back: fee, left: fee, right: fee }),
  areas: z.object({ front: areaSchema, back: areaSchema, left: areaSchema, right: areaSchema }),
});

/** Mockup photos are shown at 4:5 (like product photos). */
export const MOCKUP_ASPECT = 4 / 5;

/** Print files are rendered this wide (px); about 12" at 200 dpi. */
export const PRINT_WIDTH = 2400;

export const sideFee = (s: CustomSettings, side: PrintSide) => s.fees[side];

/** Blank price + a fee per printed side. */
export function customPrice(base: number, sides: PrintSide[], s: CustomSettings) {
  return base + sides.reduce((sum, side) => sum + sideFee(s, side), 0);
}

/** e.g. "Front print", "Front + back + left print". */
export function printLabel(sides: PrintSide[]) {
  const names = PRINT_SIDES.filter((s) => sides.includes(s)).map((s, i) =>
    i === 0 ? SIDE_LABEL[s] : SIDE_LABEL[s].toLowerCase()
  );
  return `${names.join(" + ") || "Front"} print`;
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

/** Fonts customers can use for text (loaded on the designer page). */
export const DESIGN_FONTS = [
  { key: "archivo", label: "Archivo", weight: 700 },
  { key: "bebas", label: "Bebas Neue", weight: 400 },
  { key: "playfair", label: "Playfair", weight: 700 },
  { key: "marker", label: "Marker", weight: 400 },
  { key: "mono", label: "Space Mono", weight: 700 },
  { key: "inter", label: "Inter", weight: 500 },
] as const;
export type DesignFont = (typeof DESIGN_FONTS)[number]["key"];

export const TEXT_COLORS = ["#0a0a0a", "#f8f6f1", "#b8463a", "#2f4a7a", "#3f5a3a", "#c9a24a", "#7a6a5a"] as const;

export const MAX_LAYERS_PER_SIDE = 8;
/** Print areas a customer can place on one side. */
export const MAX_BOXES_PER_SIDE = 4;

/** A print area the customer placed: fractions of the mockup photo. */
export interface PrintBox extends PrintArea {
  id: string;
}

const boxSchema = z.object({
  id: z.string().max(40),
  x: fraction,
  y: fraction,
  w: z.number().min(0.02).max(1),
  h: z.number().min(0.02).max(1),
});

/** Positions are fractions of the layer's print area; x / y is its centre. */
const position = {
  id: z.string().max(40),
  boxId: z.string().max(40),
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
};

export const layerSchema = z.discriminatedUnion("type", [
  z.object({
    ...position,
    type: z.literal("image"),
    /** Width as a fraction of the print area's width. */
    w: z.number().min(0.02).max(3),
    /** Height ÷ width of the image. */
    aspect: z.number().min(0.01).max(100),
    src: z.string().url().max(500),
  }),
  z.object({
    ...position,
    type: z.literal("text"),
    text: z.string().trim().min(1).max(60),
    font: z.enum(DESIGN_FONTS.map((f) => f.key) as [DesignFont, ...DesignFont[]]),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    /** Font size as a fraction of the print area's width. */
    size: z.number().min(0.02).max(1),
  }),
]);
export type DesignLayer = z.infer<typeof layerSchema>;

const uploaded = z.object({ url: z.string().url().max(500), publicId: z.string().max(200) });

export const designInputSchema = z.object({
  code: z.string().max(12),
  sides: z
    .array(
      z.object({
        side: z.enum(PRINT_SIDES),
        boxes: z.array(boxSchema).min(1).max(MAX_BOXES_PER_SIDE),
        layers: z.array(layerSchema).min(1).max(MAX_LAYERS_PER_SIDE),
        preview: uploaded,
        print: uploaded,
      })
    )
    .min(1, "Add a design to at least one side")
    .max(PRINT_SIDES.length)
    .refine((sides) => new Set(sides.map((s) => s.side)).size === sides.length, "Each side once")
    .refine(
      (sides) => sides.every((s) => s.layers.every((l) => s.boxes.some((b) => b.id === l.boxId))),
      "Every layer must sit in a print area"
    ),
  assetIds: z.array(z.string().max(200)).max(MAX_LAYERS_PER_SIDE * 2),
});
export type DesignInput = z.infer<typeof designInputSchema>;
