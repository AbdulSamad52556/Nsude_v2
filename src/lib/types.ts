export type Fit = "Slim" | "Regular" | "Relaxed" | "Oversized" | "Boxy";

export type Size = "S" | "M" | "L" | "XL" | "XXL";

export interface ColorOption {
  name: string;
  hex: string;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  story: string;
  images: ProductImage[];
  colors: ColorOption[];
  sizes: Size[];
  unavailableSizes?: Size[];
  category: "T-Shirts" | "Long Sleeve";
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
