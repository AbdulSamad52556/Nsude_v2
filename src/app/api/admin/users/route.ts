import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin, superadminEmail } from "@/lib/server/auth";
import { canGrant } from "@/lib/adminPermissions";
import { hashPassword } from "@/lib/server/password";
import { adminActor, recordAudit } from "@/lib/server/audit";
import { adminUserChanges, createAdminUserSchema, toAdminUserView } from "@/lib/server/adminUsers";
import { fieldErrors } from "@/lib/validation";

/** Adds someone who can sign in to admin, with no more access than the adder has. */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin("users.manage");
  if (error) return error;

  const parsed = createAdminUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { password, ...data } = parsed.data;
  if (!canGrant(admin, data.permissions)) {
    return NextResponse.json({ error: "You can only give access you have yourself." }, { status: 403 });
  }
  if (data.email === superadminEmail() || (await db.adminUser.findUnique({ where: { email: data.email } }))) {
    return NextResponse.json({ error: "That email already has admin access", fields: { email: "Already in use" } }, { status: 409 });
  }

  const user = await db.adminUser.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  await recordAudit({
    actor: adminActor(admin.email),
    entity: "admin_user",
    entityId: user.id,
    entityLabel: user.email,
    action: "Admin user added",
    changes: adminUserChanges(null, user, true),
  });
  return NextResponse.json({ user: toAdminUserView(user) }, { status: 201 });
}
