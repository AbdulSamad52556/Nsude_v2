import "server-only";
import { z } from "zod";
import type { AdminUser } from "@prisma/client";
import { ADMIN_MIN_PASSWORD, describePermissions, normalizePermissions } from "@/lib/adminPermissions";
import type { Change } from "@/lib/server/audit";

const base = {
  name: z.string().trim().min(1, "Enter a name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  permissions: z.array(z.string().max(40)).max(40).transform(normalizePermissions),
  active: z.boolean(),
};
export const passwordSchema = z
  .string()
  .min(ADMIN_MIN_PASSWORD, `Use at least ${ADMIN_MIN_PASSWORD} characters`)
  .max(200);

export const createAdminUserSchema = z.object({ ...base, password: passwordSchema });
// On edit, a blank password keeps the current one.
export const updateAdminUserSchema = z.object({
  ...base,
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

/** Safe to send to the browser: everything but the password hash. */
export function toAdminUserView(u: AdminUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    permissions: normalizePermissions(u.permissions),
    active: u.active,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
export type AdminUserView = ReturnType<typeof toAdminUserView>;

/** Audit rows for an edit; the password itself is never logged. */
export function adminUserChanges(
  before: Pick<AdminUser, "name" | "email" | "permissions" | "active"> | null,
  after: Pick<AdminUser, "name" | "email" | "permissions" | "active">,
  passwordChanged: boolean
): Change[] {
  const changes: Change[] = [];
  const add = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from, to });
  };
  add("Name", before?.name ?? "—", after.name);
  add("Email", before?.email ?? "—", after.email);
  add("Status", before ? (before.active ? "Active" : "Disabled") : "—", after.active ? "Active" : "Disabled");
  add("Access", before ? describePermissions(before.permissions) : "—", describePermissions(after.permissions));
  if (passwordChanged) changes.push({ field: "Password", from: before ? "••••••" : "—", to: before ? "Changed" : "Set" });
  return changes;
}
