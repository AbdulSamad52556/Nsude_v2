import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Minimal Razorpay client over its REST API (no SDK needed). Keys come from
// .env: RAZORPAY_KEY_ID (public, sent to the checkout popup) and
// RAZORPAY_KEY_SECRET (server only). Test keys (rzp_test_…) take no real money.

const API = "https://api.razorpay.com/v1";

export function razorpayEnabled() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  return { id, secret, header: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: auth().header, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Razorpay ${path} failed (${res.status}): ${data?.error?.description ?? "unknown error"}`);
  }
  return data as T;
}

/** Creates a Razorpay order for `amount` rupees; payments auto-capture. */
export function createRazorpayOrder(amount: number, receipt: string) {
  return call<{ id: string; amount: number; currency: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt, payment_capture: 1 }),
  });
}

/** The payment that paid this Razorpay order, if any (captured, or
    authorized and about to be captured). */
export async function findSuccessfulPayment(razorpayOrderId: string) {
  const { items } = await call<{ items: { id: string; status: string }[] }>(
    `/orders/${encodeURIComponent(razorpayOrderId)}/payments`
  );
  return items.find((p) => p.status === "captured" || p.status === "authorized") ?? null;
}

function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Checks the signature the checkout popup returns after a payment. */
export function verifyPaymentSignature(razorpayOrderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", auth().secret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Checks a webhook's X-Razorpay-Signature against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export function razorpayKeyId() {
  return auth().id;
}
