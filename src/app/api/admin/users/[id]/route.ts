import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin, superadminEmail } from "@/lib/server/auth";
import { canGrant, canManageUser } from "@/lib/adminPermissions";
import { hashPassword } from "@/lib/server/password";
import { isObjectId } from "@/lib/server/revalidate";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { adminUserChanges, toAdminUserView, updateAdminUserSchema } from "@/lib/server/adminUsers";
import { fieldErrors } from "@/lib/validation";

type Params = { params: { id: string } };
const notFound = () => NextResponse.json({ error: "User not found" }, { status: 404 });
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

/** Edits an admin user's details, access or password. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireAdmin("users.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();
  const existing = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();
  if (existing.id === admin.id) return forbidden("You can't change your own account here. Use My Password for your password.");
  if (!canManageUser(admin, existing)) return forbidden("This user has access you don't have, so you can't change them.");

  const parsed = updateAdminUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { password, ...data } = parsed.data;
  if (!canGrant(admin, data.permissions)) return forbidden("You can only give access you have yourself.");
  if (data.email !== existing.email) {
    const taken = data.email === superadminEmail() || (await db.adminUser.findUnique({ where: { email: data.email } }));
    if (taken) {
      return NextResponse.json({ error: "That email already has admin access", fields: { email: "Already in use" } }, { status: 409 });
    }
  }

  const passwordChanged = Boolean(password);
  const user = await db.adminUser.update({
    where: { id: existing.id },
    data: {
      ...data,
      // A new password signs the user out everywhere.
      ...(passwordChanged ? { passwordHash: await hashPassword(password!), sessionVersion: { increment: 1 } } : {}),
    },
  });

  const changes = adminUserChanges(existing, user, passwordChanged);
  if (changes.length > 0) {
    await recordAudit({
      actor: adminActor(admin.email),
      entity: "admin_user",
      entityId: user.id,
      entityLabel: user.email,
      action: "Admin user updated",
      changes,
    });
  }
  return NextResponse.json({ user: toAdminUserView(user) });
}

/** Removes an admin user; their sessions stop working at once. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { admin, error } = await requireAdmin("users.manage");
  if (error) return error;
  if (!isObjectId(params.id)) return notFound();
  const existing = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();
  if (existing.id === admin.id) return forbidden("You can't change your own account here. Use My Password for your password.");
  if (!canManageUser(admin, existing)) return forbidden("This user has access you don't have, so you can't change them.");

  await db.adminUser.delete({ where: { id: existing.id } });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "admin_user",
    entityId: existing.id,
    entityLabel: existing.email,
    action: "Admin user removed",
    changes: adminUserChanges(existing, { ...existing, active: false, permissions: [] }, false),
  });
  return NextResponse.json({ ok: true });
}
