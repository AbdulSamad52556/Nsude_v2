import { NextResponse } from "next/server";
import { clearCustomerSession } from "@/lib/server/customer";

/** Signs the customer out. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearCustomerSession(response);
  return response;
}
