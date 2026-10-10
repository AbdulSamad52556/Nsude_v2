import { Bebas_Neue, Permanent_Marker, Playfair_Display, Space_Mono } from "next/font/google";
import type { DesignFont } from "@/lib/custom";

// Extra fonts for text on custom tees; loaded only on the designer page.
// (Archivo and Inter are the site's own fonts.)
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-design-bebas", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: "700", variable: "--font-design-playfair", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-design-marker", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: "700", variable: "--font-design-mono", display: "swap" });

/** Class names that define the font variables. */
export const designFontVariables = [bebas.variable, playfair.variable, marker.variable, mono.variable].join(" ");

/** CSS font-family for each font option. */
export const DESIGN_FONT_FAMILY: Record<DesignFont, string> = {
  archivo: "var(--font-archivo)",
  inter: "var(--font-inter)",
  bebas: "var(--font-design-bebas)",
  playfair: "var(--font-design-playfair)",
  marker: "var(--font-design-marker)",
  mono: "var(--font-design-mono)",
};
