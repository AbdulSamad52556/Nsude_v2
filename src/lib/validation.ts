// Input schemas shared by the admin forms (client) and admin API (server),
// so both sides agree on what a valid product / hero slide looks like.
import { z } from "zod";
import { CATEGORIES, FITS, SIZES } from "./types";

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

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    slug: z
      .string()
      .trim()
      .min(2, "Slug is required")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens"),
    price: z.number().int("Price must be whole rupees").positive("Price must be above 0"),
    compareAtPrice: z.number().int().positive().nullish(),
    description: z.string().trim().min(10, "Add a short description").max(1000),
    story: z.string().trim().max(2000).default(""),
    images: z.array(imageSchema).min(1, "Add at least one image").max(10),
    colors: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Color name is required").max(40),
          hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0a0a0a"),
        })
      )
      .min(1, "Add at least one color"),
    sizes: z.array(z.enum(SIZES)).min(1, "Select at least one size"),
    unavailableSizes: z.array(z.enum(SIZES)).default([]),
    category: z.enum(CATEGORIES),
    material: z.string().trim().max(120).default(""),
    fit: z.enum(FITS),
    weight: z.string().trim().max(40).default(""),
    stock: z.number().int().min(0, "Stock can't be negative"),
    featured: z.boolean(),
    newArrival: z.boolean(),
    measurements: z
      .array(z.object({ label: z.string().trim().min(1).max(40), values: sizeValuesSchema }))
      .default([]),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "Compare-at price must be higher than the price",
    path: ["compareAtPrice"],
  })
  .refine((p) => p.unavailableSizes.every((s) => p.sizes.includes(s)), {
    message: "Sold-out sizes must be sizes the product comes in",
    path: ["unavailableSizes"],
  });

export type ProductInput = z.infer<typeof productInputSchema>;

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

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
