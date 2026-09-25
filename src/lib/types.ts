export const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Boxy"] as const;
export type Fit = (typeof FITS)[number];

export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export const CATEGORIES = ["T-Shirts", "Long Sleeve"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ProductImage {
  src: string;
  alt: string;
  /** Cloudinary public id; absent for external URLs. */
  publicId?: string | null;
  width?: number | null;
  height?: number | null;
}

/** One colorway of a product, with its own photos, stock and sold-out
    sizes. Shown as its own card in the shop, at /product/<code>. */
export interface ColorVariant {
  name: string;
  /** Public product code, e.g. "7K2Q" — unique store-wide, never changes. */
  code: string;
  hex: string;
  images: ProductImage[];
  stock: number;
  unavailableSizes: Size[];
  /** Prices for specific sizes in this color; other sizes use the
      product's base price. Use `priceFor` rather than reading directly. */
  sizePrices: Partial<Record<Size, number>>;
}

export interface Product {
  id: string;
  name: string;
  /** Base price; a color can set its own price per size (see priceFor). */
  price: number;
  compareAtPrice?: number | null;
  description: string;
  story: string;
  /** In display order; the first is the default color. Always 1+. */
  variants: ColorVariant[];
  sizes: Size[];
  category: Category;
  material: string;
  fit: Fit;
  weight: string;
  featured: boolean;
  newArrival: boolean;
  measurements: {
    label: string;
    values: Record<Size, string>;
  }[];
}

/** A product shown in one specific color — the unit the shop lists. */
export interface ProductListing {
  product: Product;
  variant: ColorVariant;
}

/** Product page URL for one colorway: /product/<code>. No names or colors
    in the URL — the code identifies both the product and the color. */
export function productHref(variant: Pick<ColorVariant, "code">) {
  return `/product/${variant.code}`;
}

/** The variant with this code, or the product's default (first) color. */
export function findVariant(product: Product, code?: string | null) {
  return product.variants.find((v) => v.code === code) ?? product.variants[0];
}

/** Price of one color in one size: its own price for that size, else the
    product's base price. */
export function priceFor(
  product: Pick<Product, "price">,
  variant: Pick<ColorVariant, "sizePrices">,
  size: Size
) {
  return variant.sizePrices[size] ?? product.price;
}

/** Lowest and highest price of a color across the sizes the product
    comes in (or of the whole product, across all its colors). */
export function priceRange(product: Pick<Product, "price" | "sizes">, variants: Pick<ColorVariant, "sizePrices">[]) {
  const sizes = product.sizes.length ? product.sizes : [...SIZES];
  const prices = variants.flatMap((v) => sizes.map((s) => priceFor(product, v, s)));
  if (prices.length === 0) return { min: product.price, max: product.price };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Total stock across all colors. */
export function totalStock(product: { variants: { stock: number }[] }) {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}

/** One t-shirt in the home hero carousel. */
export interface HeroSlide {
  id: string;
  position: number;
  image: { src: string; width: number; height: number; publicId?: string | null };
  /** `code` is the product's default colorway — where the slide links;
      `priceRange` is that color's prices across sizes. */
  product: Pick<Product, "id" | "name"> & { code: string; priceRange: { min: number; max: number } };
}
