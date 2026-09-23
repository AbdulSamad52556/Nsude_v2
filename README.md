# NSUDE — Premium Menswear

A production-quality ecommerce frontend for NSUDE, a premium men's T-shirt label. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Framer Motion.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## Replacing Placeholder Photography

All imagery is centralized in two files so it can be swapped without touching component code:

- `src/lib/images.ts` — campaign/editorial imagery (hero, collection campaign, about page, fit imagery).
- `src/lib/products.ts` — per-product photography, referenced via `productImagePool` in `src/lib/images.ts`.

Replace the Unsplash URLs with your own asset paths (e.g. `/images/...` served from `public/`, or a CDN/DAM URL) — no other code changes are required as long as the image dimensions are reasonably similar.

## Product Data

Products live entirely in `src/lib/products.ts`, typed by `src/lib/types.ts`. Each product has id, slug, price (INR), description, images, colors, sizes, category, material, fit, stock, `featured`/`newArrival` flags, and measurements — structured so it can be swapped for a real backend/CMS (Shopify, Sanity, a custom API) by replacing the data-access functions (`getProductBySlug`, `getFeaturedProducts`, etc.) with real fetches, while keeping the same shape.

## Cart & Checkout

Cart state lives in `src/context/CartContext.tsx`, persisted to `localStorage`. Checkout (`src/app/checkout/page.tsx`) is a self-contained UI flow (no real payment gateway wired up) — plug in a payment provider (Razorpay, Stripe) at the `handleSubmit` call site.

## Project Structure

```
src/
  app/            Routes (App Router)
  components/
    layout/       Navbar, MobileMenu, Footer, Preloader, CustomCursor
    home/         Homepage sections
    product/      Gallery, info, selectors, cards
    cart/         Cart drawer + line items
    search/       Full-screen search overlay
    shop/         Shop page filtering/sorting
    ui/           Reveal, AnimatedText, MagneticButton, SectionHeading, Newsletter, Marquee
  context/        Cart + UI (search overlay) React context
  lib/            Types, product data, image registry, utils
```

## Notes

- The `stone` color token is tuned for use on dark backgrounds only; use `ash` for secondary/label text on light backgrounds to keep WCAG AA contrast.
- Animations respect `prefers-reduced-motion` globally (see `globals.css` and per-component `useReducedMotion` checks).
- The custom cursor and magnetic buttons are desktop-only (`pointer: fine`) and disabled under reduced motion.
