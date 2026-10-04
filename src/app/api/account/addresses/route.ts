import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { getCustomer, newAddressId, toAccountData } from "@/lib/server/customer";
import { fieldErrors } from "@/lib/validation";
import { customerActor, describeAddress, recordAudit } from "@/lib/server/audit";
import { MAX_SAVED_ADDRESSES, addressSchema } from "@/lib/account";
import { recordActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

/** Saves a new address (the first one becomes the default). */
export async function POST(request: NextRequest) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  if (customer.addresses.length >= MAX_SAVED_ADDRESSES) {
    return NextResponse.json({ error: `You can save up to ${MAX_SAVED_ADDRESSES} addresses.` }, { status: 400 });
  }

  const id = newAddressId();
  const makeDefault = body?.makeDefault === true || customer.addresses.length === 0;
  const updated = await db.customer.update({
    where: { id: customer.id },
    data: {
      addresses: { push: { id, ...parsed.data } },
      ...(makeDefault ? { defaultAddressId: id } : {}),
    },
  });
  await recordAudit({
    actor: customerActor(customer.phone),
    entity: "customer",
    entityId: customer.id,
    entityLabel: `+91 ${customer.phone}`,
    action: "Address added",
    changes: [
      { field: "Address", from: "—", to: describeAddress(parsed.data) },
      ...(makeDefault ? [{ field: "Default address", from: "—", to: "this address" }] : []),
    ],
  });
  await recordActivity("address_saved", { new: true }, { customerId: customer.id });
  return NextResponse.json({ account: toAccountData(updated), id });
}
