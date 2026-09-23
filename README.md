# NSUDE — Premium Menswear

A production-quality ecommerce frontend for NSUDE, a premium men's T-shirt label. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Framer Motion.

## Getting Started

```bash
cp .env.example .env   # then fill in MongoDB, Cloudinary and admin values
npm install            # also generates the Prisma client
npm run db:push        # create indexes in MongoDB
npm run db:seed        # import the starter catalog + hero slides (safe to re-run)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin panel is at [/admin](http://localhost:3000/admin); sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

## Backend

The backend runs inside this Next.js app:

- **Database** — MongoDB Atlas via Prisma 6 (`prisma/schema.prisma`): `Product` and `HeroSlide`.
- **Images** — Cloudinary, uploaded through `/api/admin/upload` into `nsude/products` and `nsude/hero`. Images removed from a product or slide are deleted from Cloudinary on save.
- **Admin auth** — a single superadmin from `.env`, signed JWT in an httpOnly cookie. `src/middleware.ts` guards `/admin/*` and `/api/admin/*`.
- **Admin API** — `src/app/api/admin/*`: products (list, create, update, delete), hero (get, replace), upload, login, logout. Inputs are validated with the zod schemas in `src/lib/validation.ts`.
- **Storefront reads** — `src/lib/server/products.ts`. Pages are statically cached and re-rendered after any admin save (`revalidatePath`).

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## Products & Photography

Products and the home hero carousel are managed in `/admin` and stored in MongoDB. The seeded products use Unsplash placeholder photos; replace them by uploading real photos in each product's edit page. `prisma/seed-data.ts` only holds the starter catalog used by `npm run db:seed`.

Campaign/editorial imagery (collection campaign, about page, fit imagery) is still static, in `src/lib/images.ts`.

## Cart & Checkout

Cart state lives in `src/context/CartContext.tsx`, persisted to `localStorage`. Checkout (`src/app/checkout/page.tsx`) is a self-contained UI flow (no real payment gateway wired up) — plug in a payment provider (Razorpay, Stripe) at the `handleSubmit` call site.

## Project Structure

```
prisma/           Schema, seed script, starter catalog
src/
  app/
    (shop)/       Storefront routes (share the shop header/footer layout)
    admin/        Admin panel (login, dashboard, products, hero)
    api/          Admin API + public search
  middleware.ts   Guards /admin and /api/admin
  components/
    admin/        Admin shell, product form, hero editor
    layout/       Navbar, MobileMenu, Footer, Preloader, CustomCursor
    home/         Homepage sections
    product/      Gallery, info, selectors, cards
    cart/         Cart drawer + line items
    search/       Full-screen search overlay
    shop/         Shop page filtering/sorting
    ui/           Reveal, AnimatedText, MagneticButton, SectionHeading, Newsletter, Marquee
  context/        Cart + UI (search overlay) React context
  lib/            Types, validation, image registry, utils
    server/       DB client, Cloudinary, auth, data access (server-only)
```

## Notes

- The `stone` color token is tuned for use on dark backgrounds only; use `ash` for secondary/label text on light backgrounds to keep WCAG AA contrast.
- Animations respect `prefers-reduced-motion` globally (see `globals.css` and per-component `useReducedMotion` checks).
- The custom cursor and magnetic buttons are desktop-only (`pointer: fine`) and disabled under reduced motion.
