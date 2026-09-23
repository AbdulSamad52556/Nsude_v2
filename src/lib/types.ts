export const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Boxy"] as const;
export type Fit = (typeof FITS)[number];

export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export const CATEGORIES = ["T-Shirts", "Long Sleeve"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ColorOption {
  name: string;
  hex: string;
}

export interface ProductImage {
  src: string;
  alt: string;
  /** Cloudinary public id; absent for external URLs. */
  publicId?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  description: string;
  story: string;
  images: ProductImage[];
  colors: ColorOption[];
  sizes: Size[];
  unavailableSizes?: Size[];
  category: Category;
  material: string;
  fit: Fit;
  weight: string;
  stock: number;
  featured: boolean;
  newArrival: boolean;
  measurements: {
    label: string;
    values: Record<Size, string>;
  }[];
}

/** One t-shirt in the home hero carousel. */
export interface HeroSlide {
  id: string;
  position: number;
  image: { src: string; width: number; height: number; publicId?: string | null };
  product: Pick<Product, "id" | "name" | "slug" | "price">;
}
