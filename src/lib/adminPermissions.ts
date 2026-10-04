// What an admin user can see or change. Shared by server checks and the
// admin UI (sidebar, Users form), so keep it free of server-only imports.

// Order matches the admin sidebar.
export const PERMISSION_AREAS = [
  { key: "dashboard", label: "Dashboard", view: "See the dashboard's store numbers and low stock" },
  {
    key: "users",
    label: "Users",
    view: "See admin users and their access",
    manage: "Add, edit and remove admin users (only with access they have themselves)",
  },
  {
    key: "orders",
    label: "Orders",
    view: "See orders, items and delivery addresses",
    manage: "Change order status",
  },
  {
    key: "products",
    label: "Products",
    view: "See products, prices and stock",
    manage: "Create, edit and delete products",
  },
  {
    key: "hero",
    label: "Hero carousel",
    view: "See the home page hero slides",
    manage: "Edit the hero slides",
  },
  { key: "customers", label: "Customers", view: "See customer accounts, contact details and saved addresses" },
  { key: "activity", label: "Customer activity", view: "See shoppers' visits and everything they did in the store" },
  {
    key: "admin_activity",
    label: "Admin user activity",
    view: "See admin users' sessions: pages, clicks, changes saved and failed sign-ins",
  },
  { key: "audit", label: "Audit", view: "See the edit history of the whole store" },
] as const satisfies readonly { key: string; label: string; view: string; manage?: string }[];

export type PermissionArea = (typeof PERMISSION_AREAS)[number]["key"];
export type Permission = `${PermissionArea}.view` | `${PermissionArea}.manage`;

export const ALL_PERMISSIONS: Permission[] = PERMISSION_AREAS.flatMap((a) =>
  "manage" in a ? [`${a.key}.view` as Permission, `${a.key}.manage` as Permission] : [`${a.key}.view` as Permission]
);

/** Shortest password allowed for admin users. */
export const ADMIN_MIN_PASSWORD = 10;

export type AdminRole = "superadmin" | "staff";

/** The signed-in admin, as the UI sees it. */
export interface AdminIdentity {
  id: string | null;
  email: string;
  name: string;
  role: AdminRole;
  permissions: Permission[];
}

/** Superadmin can do everything; "manage" includes "view". */
export function can(admin: Pick<AdminIdentity, "role" | "permissions">, permission: Permission) {
  if (admin.role === "superadmin") return true;
  if (admin.permissions.includes(permission)) return true;
  const [area, level] = permission.split(".");
  return level === "view" && admin.permissions.includes(`${area}.manage` as Permission);
}

/** Admin pages in sidebar order, with the permission each needs. */
export const ADMIN_PAGES: { href: string; permission: Permission }[] = [
  { href: "/admin", permission: "dashboard.view" },
  { href: "/admin/users", permission: "users.view" },
  { href: "/admin/orders", permission: "orders.view" },
  { href: "/admin/products", permission: "products.view" },
  { href: "/admin/hero", permission: "hero.view" },
  { href: "/admin/customers", permission: "customers.view" },
  { href: "/admin/activity", permission: "activity.view" },
  { href: "/admin/activity?area=admin", permission: "admin_activity.view" },
  { href: "/admin/audit", permission: "audit.view" },
];

/** Where to land after sign-in: the first page this admin may open. */
export function firstAllowedPage(admin: Pick<AdminIdentity, "role" | "permissions">) {
  return ADMIN_PAGES.find((p) => can(admin, p.permission))?.href ?? null;
}

/**
 * Whether `actor` may give (or take away) this set of access. Nobody can
 * hand out more than they have, so a user with "Users: manage" can't make
 * themselves or anyone else more powerful.
 */
export function canGrant(actor: Pick<AdminIdentity, "role" | "permissions">, permissions: readonly string[]) {
  return actor.role === "superadmin" || normalizePermissions(permissions).every((p) => can(actor, p));
}

/** The access levels `actor` may hand out (all of them for the super admin). */
export function grantableFor(actor: Pick<AdminIdentity, "role" | "permissions">): Permission[] {
  return ALL_PERMISSIONS.filter((p) => can(actor, p));
}

/** Whether `actor` may edit or remove an admin user with these permissions. */
export function canManageUser(
  actor: Pick<AdminIdentity, "id" | "role" | "permissions">,
  target: { id: string; permissions: readonly string[] }
) {
  if (actor.role === "superadmin") return true;
  return can(actor, "users.manage") && actor.id !== target.id && canGrant(actor, target.permissions);
}

/** Drops unknown values and adds "view" wherever "manage" was given. */
export function normalizePermissions(list: readonly string[]): Permission[] {
  const set = new Set(list.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p)));
  for (const p of Array.from(set)) {
    if (p.endsWith(".manage")) set.add(p.replace(".manage", ".view") as Permission);
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

/** "Orders (manage) · Customers (view)" */
export function describePermissions(list: readonly string[]) {
  const perms = normalizePermissions(list);
  if (perms.length === 0) return "No access";
  return PERMISSION_AREAS.filter((a) => perms.includes(`${a.key}.view` as Permission))
    .map((a) => `${a.label} (${perms.includes(`${a.key}.manage` as Permission) ? "manage" : "view"})`)
    .join(" · ");
}
