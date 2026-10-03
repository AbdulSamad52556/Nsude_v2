import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import type { Customer } from "@prisma/client";
import { db } from "./db";
import type { AccountData } from "@/lib/account";
import { OTP_LENGTH } from "@/lib/account";

// Customer sessions: a signed token in an httpOnly cookie, separate from the
// admin session (different cookie and a "customer" kind claim).

export const CUSTOMER_COOKIE = "nsude_customer";
const SESSION_DAYS = 30;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to a random string of 32+ characters");
  return new TextEncoder().encode(secret);
}

export async function setCustomerSession(response: NextResponse, customer: Pick<Customer, "id" | "phone">) {
  const token = await new SignJWT({ kind: "customer", phone: customer.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customer.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearCustomerSession(response: NextResponse) {
  response.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The signed-in customer, or null (no / invalid / expired session). */
export async function getCustomer(): Promise<Customer | null> {
  const token = cookies().get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== "customer" || typeof payload.sub !== "string" || !/^[a-f0-9]{24}$/.test(payload.sub)) {
      return null;
    }
    return await db.customer.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export function toAccountData(c: Customer): AccountData {
  return {
    phone: c.phone,
    name: c.name,
    email: c.email,
    addresses: c.addresses.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state as AccountData["addresses"][number]["state"],
      pincode: a.pincode,
    })),
    defaultAddressId: c.defaultAddressId ?? null,
  };
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Codes are stored hashed (with the server secret), never in plain text. */
export function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
}

export function otpMatches(phone: string, code: string, storedHash: string) {
  const a = Buffer.from(hashOtp(phone, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newOtpCode() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Random id for a saved address. */
export const newAddressId = () => randomBytes(8).toString("hex");
