import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { toProduct } from "./products";
import { customPrice, customSettingsSchema, DEFAULT_CUSTOM_SETTINGS, type CustomSettings } from "@/lib/custom";
import { priceFor } from "@/lib/types";

const KEY = "custom";

/** Custom-tee settings (prices, print areas), with defaults filled in. */
export async function getCustomSettings(): Promise<CustomSettings> {
  const row = await db.siteSetting.findUnique({ where: { key: KEY } });
  const stored = (row?.value ?? {}) as Partial<CustomSettings>;
  const merged = {
    ...DEFAULT_CUSTOM_SETTINGS,
    ...stored,
    fees: { ...DEFAULT_CUSTOM_SETTINGS.fees, ...(stored.fees ?? {}) },
    areas: { ...DEFAULT_CUSTOM_SETTINGS.areas, ...(stored.areas ?? {}) },
  };
  const parsed = customSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CUSTOM_SETTINGS;
}

export async function saveCustomSettings(value: CustomSettings) {
  await db.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}

/** Blank tees offered for printing, newest last; only colours with a photo. */
export async function getBlanks() {
  const rows = await db.product.findMany({ where: { blank: true }, orderBy: { createdAt: "asc" } });
  return rows
    .map(toProduct)
    .map((p) => ({ ...p, variants: p.variants.filter((v) => v.images.length > 0) }))
    .filter((p) => p.variants.length > 0);
}

/** What the home page teaser needs, or null while custom tees are off. */
export async function getCustomizeTeaser() {
  const [settings, blanks] = await Promise.all([getCustomSettings(), getBlanks()]);
  const first = blanks[0];
  if (!settings.enabled || !first) return null;
  const v = first.variants[0];
  const cheapest = Math.min(...blanks.flatMap((b) => b.variants.flatMap((x) => b.sizes.map((s) => priceFor(b, x, s)))));
  return {
    photo: { src: v.images[0].src, alt: `${first.name} in ${v.name}, ready for your design` },
    area: settings.areas.front,
    fromPrice: customPrice(cheapest, ["front"], settings),
  };
}

/** Customer uploads and renders all live in this Cloudinary folder. */
export const CUSTOM_FOLDER = "nsude/custom/";

/** Is this a file our upload endpoint put in the custom folder? */
export function isCustomUpload(url: string, publicId: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return (
    publicId.startsWith(CUSTOM_FOLDER) &&
    url.startsWith(`https://res.cloudinary.com/${cloud}/`) &&
    url.includes(publicId)
  );
}
