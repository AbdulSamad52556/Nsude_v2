// Initial catalog, imported into MongoDB by `npm run db:seed`. After
// seeding, products are managed from /admin — edits here have no effect on
// an already-seeded database. The `id` values are ignored (MongoDB assigns
// its own).
import { Product, ProductImage, Size } from "../src/lib/types";
import { productImagePool, campaignImages } from "../src/lib/images";

/** Starter-catalog shape: one shared image set, color list and stock per
    product. The seed script turns each color into its own variant. */
type SeedProduct = Omit<Product, "variants"> & {
  /** Seed-only key used to link hero slides to products; not stored. */
  slug: string;
  images: ProductImage[];
  colors: { name: string; hex: string }[];
  stock: number;
  unavailableSizes?: Size[];
};

const SIZES: Size[] = ["S", "M", "L", "XL", "XXL"];

/** The original hero carousel: transparent cutouts in public/tshirts, each
    linked to a product by slug. The seed uploads these to Cloudinary. */
export const heroSeed = [
  { slug: "core-tee", file: "public/tshirts/tee-1.png" },
  { slug: "heavy-tee", file: "public/tshirts/tee-2.png" },
  { slug: "signature-tee", file: "public/tshirts/tee-3.png" },
  { slug: "oversized-tee", file: "public/tshirts/tee-4.png" },
  { slug: "archive-tee", file: "public/tshirts/tee-5.png" },
];

function measurements(base: {
  shoulder: number;
  chest: number;
  length: number;
}) {
  const step = { shoulder: 1.5, chest: 2.5, length: 1.8 };
  const build = (key: keyof typeof base) =>
    SIZES.reduce((acc, size, i) => {
      acc[size] = `${(base[key] + step[key] * i).toFixed(1)}"`;
      return acc;
    }, {} as Record<Size, string>);

  return [
    { label: "Shoulder", values: build("shoulder") },
    { label: "Chest", values: build("chest") },
    { label: "Length", values: build("length") },
  ];
}

export const products: SeedProduct[] = [
  {
    id: "p1",
    name: "NSUDE CORE TEE",
    slug: "core-tee",
    price: 1499,
    description:
      "The foundation of the wardrobe. A clean, regular-fit tee built from mid-weight combed cotton with a precise crew neck and reinforced seams.",
    story:
      "Every label needs a constant — one piece that never goes out of rotation. The Core Tee is ours. No logos, no distractions. Just a considered cut, a substantial hand-feel, and a fit that works with everything.",
    images: [
      { src: productImagePool[0], alt: "NSUDE Core Tee, front view" },
      { src: productImagePool[1], alt: "NSUDE Core Tee, back view" },
      { src: campaignImages.fitRegular, alt: "NSUDE Core Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Off-White", hex: "#f4f1ea" },
      { name: "Grey", hex: "#8a8a84" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "180gsm Combed Cotton",
    fit: "Regular",
    weight: "180 GSM",
    stock: 42,
    featured: true,
    newArrival: false,
    measurements: measurements({ shoulder: 17, chest: 38, length: 26 }),
  },
  {
    id: "p2",
    name: "NSUDE HEAVY TEE",
    slug: "heavy-tee",
    price: 1799,
    description:
      "Oversized and substantial. Heavyweight 240gsm cotton with a dropped shoulder and boxy silhouette for a considered, off-duty fit.",
    story:
      "Weight changes everything — how a tee drapes, how it ages, how it feels against the skin. The Heavy Tee is cut generously and built dense, so it holds its shape wear after wear instead of thinning out.",
    images: [
      { src: productImagePool[2], alt: "NSUDE Heavy Tee, front view" },
      { src: productImagePool[3], alt: "NSUDE Heavy Tee, detail view" },
      { src: campaignImages.fitOversized, alt: "NSUDE Heavy Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Stone", hex: "#8a8a84" },
      { name: "Olive", hex: "#5a5c46" },
    ],
    sizes: SIZES,
    unavailableSizes: ["S"],
    category: "T-Shirts",
    material: "240gsm Heavyweight Cotton",
    fit: "Oversized",
    weight: "240 GSM",
    stock: 28,
    featured: true,
    newArrival: true,
    measurements: measurements({ shoulder: 19, chest: 42, length: 28 }),
  },
  {
    id: "p3",
    name: "NSUDE SIGNATURE TEE",
    slug: "signature-tee",
    price: 1999,
    description:
      "Our most refined tee. Long-staple Pima cotton, a self-fabric collar, and a fit calibrated between regular and slim for a cleaner line.",
    story:
      "Signature pieces earn their name over time. This is the tee we return to when the details matter — the collar that keeps its shape, the seams that lie flat, the drape that photographs as well as it wears.",
    images: [
      { src: productImagePool[4], alt: "NSUDE Signature Tee, front view" },
      { src: productImagePool[5], alt: "NSUDE Signature Tee, flat lay" },
      { src: campaignImages.fitRegular, alt: "NSUDE Signature Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Bone", hex: "#faf8f3" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "Long-Staple Pima Cotton",
    fit: "Regular",
    weight: "200 GSM",
    stock: 35,
    featured: true,
    newArrival: false,
    measurements: measurements({ shoulder: 17.5, chest: 39, length: 27 }),
  },
  {
    id: "p4",
    name: "NSUDE OVERSIZED TEE",
    slug: "oversized-tee",
    price: 1699,
    description:
      "A deliberately generous cut with dropped shoulders and a wider body. Garment-dyed for a soft, lived-in hand-feel from the first wear.",
    story:
      "Proportion is a design decision, not an accident. The Oversized Tee is drafted from scratch to hang correctly — wide enough to feel considered, never sloppy.",
    images: [
      { src: productImagePool[6], alt: "NSUDE Oversized Tee, front view" },
      { src: productImagePool[7], alt: "NSUDE Oversized Tee, back view" },
      { src: campaignImages.fitOversized, alt: "NSUDE Oversized Tee worn, editorial" },
    ],
    colors: [
      { name: "Charcoal", hex: "#3a3a38" },
      { name: "Off-White", hex: "#f4f1ea" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "220gsm Garment-Dyed Cotton",
    fit: "Oversized",
    weight: "220 GSM",
    stock: 19,
    featured: false,
    newArrival: true,
    measurements: measurements({ shoulder: 19.5, chest: 43, length: 28.5 }),
  },
  {
    id: "p5",
    name: "NSUDE STUDIO TEE",
    slug: "studio-tee",
    price: 1599,
    description:
      "A relaxed, easy fit designed for movement. Brushed interior finish for softness, with a slightly dropped hem at the back.",
    story:
      "Made for the hours between things — studio, street, or somewhere in between. Nothing about the Studio Tee asks for attention, which is exactly the point.",
    images: [
      { src: productImagePool[8], alt: "NSUDE Studio Tee, front view" },
      { src: productImagePool[9], alt: "NSUDE Studio Tee, detail view" },
      { src: campaignImages.fitRelaxed, alt: "NSUDE Studio Tee worn, editorial" },
    ],
    colors: [
      { name: "Grey", hex: "#8a8a84" },
      { name: "Black", hex: "#0a0a0a" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "200gsm Brushed Cotton",
    fit: "Relaxed",
    weight: "200 GSM",
    stock: 31,
    featured: false,
    newArrival: false,
    measurements: measurements({ shoulder: 18, chest: 40.5, length: 27.5 }),
  },
  {
    id: "p6",
    name: "NSUDE ESSENTIAL TEE",
    slug: "essential-tee",
    price: 1499,
    description:
      "The everyday standard. A true regular fit in a breathable mid-weight cotton, made to layer or wear alone without losing shape.",
    story:
      "Essentials don't need reinvention — they need discipline. Correct proportions, a stable knit, and a neckline that survives a hundred washes.",
    images: [
      { src: productImagePool[10], alt: "NSUDE Essential Tee, front view" },
      { src: productImagePool[11], alt: "NSUDE Essential Tee, back view" },
      { src: campaignImages.fitRegular, alt: "NSUDE Essential Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "White", hex: "#faf8f3" },
      { name: "Navy", hex: "#2a2f3a" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "190gsm Combed Cotton",
    fit: "Regular",
    weight: "190 GSM",
    stock: 50,
    featured: true,
    newArrival: false,
    measurements: measurements({ shoulder: 17, chest: 38.5, length: 26.5 }),
  },
  {
    id: "p7",
    name: "NSUDE BOXY TEE",
    slug: "boxy-tee",
    price: 1899,
    description:
      "A structured, boxy silhouette with a straight hem and squared shoulder line. Built from a dense cotton for a sculpted, architectural shape.",
    story:
      "Structure over slouch. The Boxy Tee holds a defined shape on the body — a straight line from shoulder to hem, engineered rather than draped.",
    images: [
      { src: productImagePool[12], alt: "NSUDE Boxy Tee, front view" },
      { src: productImagePool[13], alt: "NSUDE Boxy Tee, flat lay" },
      { src: campaignImages.fitOversized, alt: "NSUDE Boxy Tee worn, editorial" },
    ],
    colors: [
      { name: "Rust", hex: "#8a5a3f" },
      { name: "Black", hex: "#0a0a0a" },
    ],
    sizes: SIZES,
    unavailableSizes: ["XXL"],
    category: "T-Shirts",
    material: "230gsm Structured Cotton",
    fit: "Boxy",
    weight: "230 GSM",
    stock: 14,
    featured: false,
    newArrival: true,
    measurements: measurements({ shoulder: 19, chest: 42.5, length: 27 }),
  },
  {
    id: "p8",
    name: "NSUDE DOUBLE-KNIT TEE",
    slug: "double-knit-tee",
    price: 2199,
    description:
      "Two layers of cotton jersey knit as one. A substantial, structured hand-feel with exceptional drape and durability.",
    story:
      "Double-knit construction gives this tee a weight and stability that single-jersey fabric can't match — it holds its form on the hanger and on the body.",
    images: [
      { src: productImagePool[14], alt: "NSUDE Double-Knit Tee, front view" },
      { src: productImagePool[15], alt: "NSUDE Double-Knit Tee, detail view" },
      { src: campaignImages.fitRegular, alt: "NSUDE Double-Knit Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Bone", hex: "#faf8f3" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "Double-Knit Cotton Jersey",
    fit: "Regular",
    weight: "260 GSM",
    stock: 22,
    featured: false,
    newArrival: false,
    measurements: measurements({ shoulder: 17.5, chest: 39.5, length: 27 }),
  },
  {
    id: "p9",
    name: "NSUDE RIBBED TEE",
    slug: "ribbed-tee",
    price: 1699,
    description:
      "A slim, body-conscious fit in a fine rib knit. Stretch cotton blend for a fit that moves with you without losing recovery.",
    story:
      "A closer cut for layering under outerwear or wearing alone. The rib construction keeps its recovery long after cheaper knits give out.",
    images: [
      { src: productImagePool[16], alt: "NSUDE Ribbed Tee, front view" },
      { src: productImagePool[17], alt: "NSUDE Ribbed Tee, back view" },
      { src: campaignImages.fitRegular, alt: "NSUDE Ribbed Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Charcoal", hex: "#3a3a38" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "95% Cotton, 5% Elastane Rib",
    fit: "Slim",
    weight: "210 GSM",
    stock: 27,
    featured: false,
    newArrival: false,
    measurements: measurements({ shoulder: 16.5, chest: 36.5, length: 26 }),
  },
  {
    id: "p10",
    name: "NSUDE WORKWEAR TEE",
    slug: "workwear-tee",
    price: 1999,
    description:
      "Inspired by utilitarian workwear. A relaxed fit in a durable, coarse-hand cotton with triple-stitched seams for reinforced wear.",
    story:
      "Built with the same logic as the garments that inspired it — durability first. Triple-stitched seams and a coarser weave designed to outlast the trend cycle.",
    images: [
      { src: productImagePool[18], alt: "NSUDE Workwear Tee, front view" },
      { src: productImagePool[19], alt: "NSUDE Workwear Tee, detail view" },
      { src: campaignImages.fitRelaxed, alt: "NSUDE Workwear Tee worn, editorial" },
    ],
    colors: [
      { name: "Olive", hex: "#5a5c46" },
      { name: "Black", hex: "#0a0a0a" },
    ],
    sizes: SIZES,
    category: "T-Shirts",
    material: "230gsm Coarse Weave Cotton",
    fit: "Relaxed",
    weight: "230 GSM",
    stock: 17,
    featured: false,
    newArrival: false,
    measurements: measurements({ shoulder: 18.5, chest: 41, length: 27.5 }),
  },
  {
    id: "p11",
    name: "NSUDE LAYER TEE",
    slug: "layer-tee",
    price: 2099,
    description:
      "A long-sleeve essential cut for layering. Lightweight cotton jersey with a fitted sleeve and slightly extended body length.",
    story:
      "The quiet piece underneath everything else. Cut slim through the sleeve and body so it layers cleanly under jackets and overshirts without adding bulk.",
    images: [
      { src: productImagePool[20], alt: "NSUDE Layer Tee, front view" },
      { src: productImagePool[21], alt: "NSUDE Layer Tee, back view" },
      { src: campaignImages.fitRegular, alt: "NSUDE Layer Tee worn, editorial" },
    ],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Grey", hex: "#8a8a84" },
    ],
    sizes: SIZES,
    category: "Long Sleeve",
    material: "180gsm Cotton Jersey",
    fit: "Regular",
    weight: "180 GSM",
    stock: 24,
    featured: false,
    newArrival: true,
    measurements: measurements({ shoulder: 17, chest: 38, length: 27.5 }),
  },
  {
    id: "p12",
    name: "NSUDE ARCHIVE TEE",
    slug: "archive-tee",
    price: 2299,
    description:
      "A limited, oversized cut from our first collection. Heavyweight cotton with a garment-washed finish for a broken-in texture.",
    story:
      "Every archive holds the pieces that defined a moment. This is ours — the original oversized block, reissued in small batches from the same pattern.",
    images: [
      { src: productImagePool[22], alt: "NSUDE Archive Tee, front view" },
      { src: productImagePool[23], alt: "NSUDE Archive Tee, detail view" },
      { src: campaignImages.fitOversized, alt: "NSUDE Archive Tee worn, editorial" },
    ],
    colors: [
      { name: "Bone", hex: "#faf8f3" },
      { name: "Black", hex: "#0a0a0a" },
    ],
    sizes: SIZES,
    unavailableSizes: ["S", "XXL"],
    category: "T-Shirts",
    material: "250gsm Garment-Washed Cotton",
    fit: "Oversized",
    weight: "250 GSM",
    stock: 9,
    featured: true,
    newArrival: true,
    measurements: measurements({ shoulder: 19.5, chest: 43.5, length: 28.5 }),
  },
];
