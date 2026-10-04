import { NextResponse } from "next/server";
import { endCustomerSession } from "@/lib/server/customer";
import { recordActivity } from "@/lib/server/activity";

/** Signs the customer out on this device (the session is deleted, so its
    tokens stop working straight away). */
export async function POST() {
  await recordActivity("signed_out");
  await endCustomerSession();
  return NextResponse.json({ ok: true });
}
