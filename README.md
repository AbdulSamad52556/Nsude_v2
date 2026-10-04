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

- **Database** — MongoDB Atlas via Prisma 6 (`prisma/schema.prisma`): `Product` and `HeroSlide`. Each product has color **variants**, each with its own photos, stock and sold-out sizes. The shop lists one card per color.
- **Pricing** — a product has a base price; each color can set its own price per size (blank = base price). Cards show "From ₹…" when a color's sizes differ, the product page shows the exact price once a size is picked, and the bag charges that color + size price.
- **Product codes** — every colorway gets a unique code of uppercase letters and digits (4 characters, e.g. `7K2Q`; longer only if 4-character codes ever run out). Product pages live at `/product/<code>` — no names or colors in URLs. Codes are assigned on save, never change, and are enforced unique by a database index. Switching color on a product page moves to that color's code.
- Upgrading an older database: `npm run db:migrate-variants` (if products still have a single image list), then `npm run db:migrate-codes`.
- **Images** — Cloudinary, uploaded through `/api/admin/upload` into `nsude/products` and `nsude/hero`. Images removed from a product or slide are deleted from Cloudinary on save.
- **Admin auth & users** — the superadmin comes from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and has full access. They add other admin users at `/admin/users` (`AdminUser`, scrypt-hashed passwords) and give each one per-area access — Users, Orders, Products, Hero carousel (none / view / manage), Dashboard, Customers and Audit (none / view). A user with Users: manage can add and edit others but only with access they have themselves, and can't change their own access or anyone with more access. Users without Dashboard land on the first page they can open. Admin users change their own password at `/admin/account`. Sessions are a signed JWT in an httpOnly cookie; `src/middleware.ts` guards `/admin/*` and `/api/admin/*`, and every admin page and API route checks the permission it needs (`src/lib/server/auth.ts`, `src/lib/adminPermissions.ts`). A user's access is read fresh on each request, so permission changes and disabling apply at once, and a new password signs them out everywhere. User changes are recorded in Audit.
- **Admin API** — `src/app/api/admin/*`: products (list, create, update, delete), hero (get, replace), upload, login, logout. Inputs are validated with the zod schemas in `src/lib/validation.ts`.
- **Shop listings (scales to large catalogs)** — a `Listing` collection holds one lean, indexed document per colorway (card fields only), rebuilt automatically whenever a product is saved or deleted (`src/lib/server/listings.ts`; repair with `npm run db:sync-listings`). The shop filters, sorts, counts and pages (24 at a time, loaded automatically as you scroll) in a single MongoDB aggregation via `/api/listings`; search (`/api/search`, debounced 300 ms, 2+ characters, input matched literally) and related / featured / Shop-The-Fit use small targeted queries. Results are cached and cleared on every admin save.
- **Checkout & orders** — guest checkout at `/checkout` (`src/components/checkout/CheckoutView.tsx`, rules in `src/lib/checkout.ts`). The browser only says *what* to buy; `/api/checkout` prices every line from the catalog, takes stock atomically (per color, never below zero) and saves an `Order`. Payment is **Cash on Delivery** or **Razorpay** (UPI, cards, netbanking, wallets) — Razorpay appears once `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are set. Online orders wait in *Awaiting payment*; the payment signature is verified on the server, and orders left unpaid for 30 minutes (or whose popup was closed) are cancelled with their stock put back. An optional Razorpay webhook (`/api/webhooks/razorpay`, `RAZORPAY_WEBHOOK_SECRET`) marks orders paid even if the customer closes the tab. Admins manage orders at `/admin/orders`: Placed → Shipped → Delivered, or Cancel (restores stock; refund online payments from the Razorpay dashboard).
- **Customer accounts** — sign up / log in with a mobile number and a one-time code (`/account`; no passwords). Codes are 6 digits, stored hashed, valid 5 minutes, 5 wrong tries, max 5 per hour per number; the session is a signed httpOnly cookie (30 days). Accounts have **orders** (including earlier guest orders with the same phone), **saved addresses** and a **profile** (name, email). Checkout stays open to guests; signed-in customers get contact details pre-filled, can pick a saved address or save a new one, and the order is linked to their account. SMS sending lives in `src/lib/server/sms.ts`. For now (`SMS_PROVIDER` unset / `screen`) no SMS is sent and the code is shown on the login screen — anyone can then open any account by typing its number, so add a provider (e.g. MSG91) there before customers rely on accounts; the code stops being shown automatically.
- **Edit history** — every change is logged in `AuditLog` (`src/lib/server/audit.ts`): customer account created / profile / addresses (incl. saved at checkout), admin product edits field by field (per-color, per-size prices, stock, sold-out sizes, photos, colors added / removed), hero carousel changes, and order events (placed, paid, status changes, unpaid cancellations) — with who, when (IST) and old → new values. Admin-only views: **Audit** (`/admin/audit`, filters + search), **Customers** (`/admin/customers`, with each customer's orders, saved addresses, signed-in devices and change history), and Audit panels on customer, product and order pages. Orders store their own copy of item prices and the delivery address, so later edits never change past orders.
- **Visitor activity** — every storefront visit is tracked from the first page to the last (`src/lib/track.ts`, `src/components/layout/ActivityTracker.tsx` → `/api/track`): pages with time spent and scroll depth, every link / button click, product and colour views, sizes, quantities, bag adds / removals, Buy Now, searches, shop filters and sorting, checkout steps and payment choice, and when the visitor leaves. The server adds what it can confirm itself: order placed, paid, payment window closed, sign-in code requested, sign-up / sign-in / sign-out, profile and address changes, order edits and cancellations (`src/lib/server/activity.ts`). A visit (`VisitSession`) ends after 30 idle minutes; a first-party cookie ties visits from one browser, and visits made as a guest are linked to the customer once they sign in. Nothing typed into forms is stored, and long digit runs in click labels are masked. Bots are skipped. Rows are deleted automatically after `ACTIVITY_RETENTION_DAYS` (default 180) by a MongoDB TTL index. Admin users are tracked the same way in the admin panel: each sign-in starts a session with every page and click, the changes they saved (merged in from Audit), sign-out, and failed sign-in attempts on their account (Activity → **Admin users**, the super admin included). The two are separate permissions: **Customer activity** (shoppers' visits at `/admin/activity`) and **Admin user activity** (admin users' sessions at `/admin/activity?area=admin`). Admins with Customer activity see every visit at `/admin/activity` (period, who, outcome, device filters and search) with a step-by-step timeline per visit, and recent visits on each customer's page.
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

Cart state lives in `src/context/CartContext.tsx`, persisted to `localStorage` (max 10 of one item per line). Prices shown in the bag are refreshed from the server on the checkout page, and the order is always charged at the server's prices — see **Checkout & orders** above.

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
