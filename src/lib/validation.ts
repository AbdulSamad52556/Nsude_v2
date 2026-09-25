// Input schemas shared by the admin forms (client) and admin API (server),
// so both sides agree on what a valid product / hero slide looks like.
import { z } from "zod";
import { CATEGORIES, FITS, SIZES } from "./types";
import { CODE_PATTERN } from "./codes";

const imageSchema = z.object({
  src: z.string().url("Image URL is invalid"),
  alt: z.string().trim().max(200).default(""),
  publicId: z.string().nullish(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

const sizeValuesSchema = z.object({
  S: z.string().trim().max(20).default(""),
  M: z.string().trim().max(20).default(""),
  L: z.string().trim().max(20).default(""),
  XL: z.string().trim().max(20).default(""),
  XXL: z.string().trim().max(20).default(""),
});

const variantSchema = z.object({
  /** Existing color's product code; omitted for new colors. The server
      keeps it only if it already belongs to this product, and assigns
      fresh codes otherwise — codes can't be chosen or changed by input. */
  code: z.string().regex(CODE_PATTERN).optional(),
  name: z.string().trim().min(1, "Color name is required").max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0a0a0a"),
  images: z.array(imageSchema).min(1, "Add at least one photo of this color").max(12),
  stock: z.number().int("Stock must be a whole number").min(0, "Stock can't be negative"),
  unavailableSizes: z.array(z.enum(SIZES)).default([]),
  /** Prices for specific sizes in this color; unset sizes use the base price. */
  sizePrices: z
    .object(
      Object.fromEntries(
        SIZES.map((s) => [
          s,
          z.number().int("Prices are whole rupees").positive("Price must be above 0").optional(),
        ])
      ) as Record<(typeof SIZES)[number], z.ZodOptional<z.ZodNumber>>
    )
    .default({}),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    compareAtPrice: z.number().int().positive().nullish(),
    description: z.string().trim().min(10, "Add a short description").max(1000),
    story: z.string().trim().max(2000).default(""),
    variants: z.array(variantSchema).min(1, "Add at least one color").max(20),
    sizes: z.array(z.enum(SIZES)).min(1, "Select at least one size"),
    category: z.enum(CATEGORIES),
    material: z.string().trim().max(120).default(""),
    fit: z.enum(FITS),
    weight: z.string().trim().max(40).default(""),
    featured: z.boolean(),
    newArrival: z.boolean(),
    measurements: z
      .array(z.object({ label: z.string().trim().min(1).max(40), values: sizeValuesSchema }))
      .default([]),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      // Price is set per color and size: every size the product is made in
      // needs a price in every color.
      for (const s of p.sizes) {
        if (!(v.sizePrices[s] && v.sizePrices[s]! > 0)) {
          ctx.addIssue({
            code: "custom",
            message: "Enter a price",
            path: ["variants", i, "sizePrices", s],
          });
        }
      }
      const key = v.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Two colors can't share the same name",
          path: ["variants", i, "name"],
        });
      }
      seen.add(key);
      if (!v.unavailableSizes.every((s) => p.sizes.includes(s))) {
        ctx.addIssue({
          code: "custom",
          message: "Sold-out sizes must be sizes the product comes in",
          path: ["variants", i, "unavailableSizes"],
        });
      }
    });
    const lowest = lowestPrice(p);
    if (p.compareAtPrice != null && lowest != null && p.compareAtPrice <= lowest) {
      ctx.addIssue({
        code: "custom",
        message: "Compare-at price must be higher than the lowest price",
        path: ["compareAtPrice"],
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

/** Lowest price across every color and offered size, or null if none set. */
function lowestPrice(p: { sizes: readonly string[]; variants: { sizePrices: Record<string, number | undefined> }[] }) {
  const prices = p.variants.flatMap((v) =>
    p.sizes.map((s) => v.sizePrices[s]).filter((n): n is number => typeof n === "number" && n > 0)
  );
  return prices.length ? Math.min(...prices) : null;
}

/**
 * The product's stored `price` — its "from" price — is derived, not typed:
 * the lowest price across all colors and sizes. It's what sorting, price
 * filters and any size without its own price fall back to. Also drops
 * prices for sizes the product isn't made in.
 */
export function withDerivedPrice(input: ProductInput) {
  const variants = input.variants.map((v) => ({
    ...v,
    sizePrices: Object.fromEntries(
      input.sizes.filter((s) => v.sizePrices[s] != null).map((s) => [s, v.sizePrices[s]!])
    ),
  }));
  return { ...input, variants, price: lowestPrice(input) ?? 0 };
}

export const heroInputSchema = z.object({
  slides: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f0-9]{24}$/, "Pick a product"),
        image: imageSchema.extend({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        }),
      })
    )
    .max(10, "Up to 10 slides"),
});

export type HeroInput = z.infer<typeof heroInputSchema>;

/** Flatten zod issues into { "field.path": "message" } for form display. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
