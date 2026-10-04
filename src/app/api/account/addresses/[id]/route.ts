import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { getCustomer, toAccountData } from "@/lib/server/customer";
import { fieldErrors } from "@/lib/validation";
import { addressChanges, customerActor, describeAddress, recordAudit } from "@/lib/server/audit";
import { addressSchema } from "@/lib/account";
import { recordActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** Edits a saved address, or makes it the default ({ makeDefault: true }). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!customer.addresses.some((a) => a.id === params.id)) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const actor = customerActor(customer.phone);
  const target = customer.addresses.find((a) => a.id === params.id)!;
  const previousDefault = customer.addresses.find((a) => a.id === customer.defaultAddressId);

  if (body?.makeDefault === true && Object.keys(body).length === 1) {
    const updated = await db.customer.update({ where: { id: customer.id }, data: { defaultAddressId: params.id } });
    await recordAudit({
      actor,
      entity: "customer",
      entityId: customer.id,
      entityLabel: `+91 ${customer.phone}`,
      action: "Default address changed",
      changes: [
        { field: "Default address", from: previousDefault ? describeAddress(previousDefault) : "—", to: describeAddress(target) },
      ],
    });
    await recordActivity("address_saved", { madeDefault: true }, { customerId: customer.id });
    return NextResponse.json({ account: toAccountData(updated) });
  }

  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const addresses = customer.addresses.map((a) => (a.id === params.id ? { id: a.id, ...parsed.data } : a));
  const updated = await db.customer.update({
    where: { id: customer.id },
    data: { addresses: { set: addresses }, ...(body?.makeDefault === true ? { defaultAddressId: params.id } : {}) },
  });
  const changes = addressChanges(target, parsed.data);
  if (changes.length) {
    await recordAudit({
      actor,
      entity: "customer",
      entityId: customer.id,
      entityLabel: `+91 ${customer.phone}`,
      action: "Address edited",
      changes: [{ field: "Was", from: describeAddress(target), to: describeAddress(parsed.data) }, ...changes],
    });
  }
  await recordActivity("address_saved", { edited: true }, { customerId: customer.id });
  return NextResponse.json({ account: toAccountData(updated) });
}

/** Removes a saved address (the next one becomes default if needed). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const addresses = customer.addresses.filter((a) => a.id !== params.id);
  if (addresses.length === customer.addresses.length) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }
  const defaultAddressId =
    customer.defaultAddressId === params.id ? addresses[0]?.id ?? null : customer.defaultAddressId;
  const updated = await db.customer.update({
    where: { id: customer.id },
    data: { addresses: { set: addresses }, defaultAddressId },
  });
  const removed = customer.addresses.find((a) => a.id === params.id)!;
  await recordAudit({
    actor: customerActor(customer.phone),
    entity: "customer",
    entityId: customer.id,
    entityLabel: `+91 ${customer.phone}`,
    action: "Address removed",
    changes: [{ field: "Address", from: describeAddress(removed), to: "—" }],
  });
  await recordActivity("address_deleted", {}, { customerId: customer.id });
  return NextResponse.json({ account: toAccountData(updated) });
}
