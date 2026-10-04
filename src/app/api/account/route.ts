import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { getCustomer, toAccountData } from "@/lib/server/customer";
import { fieldErrors } from "@/lib/validation";
import { customerActor, diffFields, recordAudit } from "@/lib/server/audit";
import { profileSchema } from "@/lib/account";
import { recordActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

const signedOut = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

/** The signed-in customer's profile and saved addresses. */
export async function GET() {
  const customer = await getCustomer();
  return customer ? NextResponse.json({ account: toAccountData(customer) }) : signedOut();
}

/** Updates name / email. */
export async function PATCH(request: NextRequest) {
  const customer = await getCustomer();
  if (!customer) return signedOut();
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const updated = await db.customer.update({ where: { id: customer.id }, data: parsed.data });
  const changes = diffFields(customer, updated, { Name: "name", Email: "email" });
  if (changes.length) {
    await recordAudit({
      actor: customerActor(customer.phone),
      entity: "customer",
      entityId: customer.id,
      entityLabel: `+91 ${customer.phone}`,
      action: "Profile updated",
      changes,
    });
  }
  await recordActivity("profile_updated", {}, { customerId: customer.id });
  return NextResponse.json({ account: toAccountData(updated) });
}
