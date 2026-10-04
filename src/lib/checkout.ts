// Checkout rules shared by the checkout page (browser) and the order API
// (server), so both agree on shipping, what a valid order looks like and
// how order statuses read.
import { z } from "zod";
import { SIZES } from "./types";
import { CODE_PATTERN } from "./codes";

export const SHIPPING_COST = 149;
export const FREE_SHIPPING_THRESHOLD = 2999;
/** Most of one item a single order can take. */
export const MAX_LINE_QUANTITY = 10;

export function shippingFor(subtotal: number) {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const PAYMENT_METHODS = ["razorpay", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What the browser sends for each bag line: only what to buy, never the
    price — the server prices every line from the catalog. */
export const cartItemSchema = z.object({
  code: z.string().regex(CODE_PATTERN),
  size: z.enum(SIZES),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});
export const cartItemsSchema = z.array(cartItemSchema).min(1, "Your bag is empty").max(30);

const text = (label: string, max = 80) =>
  z.string().trim().min(1, `Enter your ${label}`).max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long`);

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().max(120).email("Enter a valid email address"),
  // 10-digit Indian mobile number; spaces, dashes and a +91 / 0 prefix are
  // tolerated and stripped.
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")),
  firstName: text("first name", 50),
  lastName: text("last name", 50),
  line1: text("address", 160),
  line2: z.string().trim().max(160).default(""),
  city: text("city", 60),
  state: z.enum(INDIAN_STATES, "Select your state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  paymentMethod: z.enum(PAYMENT_METHODS, "Choose a payment method"),
  items: cartItemsSchema,
  /** Signed-in customers: save this delivery address to the account. */
  saveAddress: z.boolean().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const ORDER_STATUSES = ["pending_payment", "placed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Placed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Not paid",
  cod: "Cash on delivery",
  refund_due: "Refund due",
};

/** Customers can change or cancel their order until it's dispatched. */
export const CUSTOMER_EDITABLE_STATUS: OrderStatus = "placed";
