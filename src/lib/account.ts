// Customer account rules shared by the account pages (browser) and the
// account / login API (server).
import { z } from "zod";
import { INDIAN_STATES } from "./checkout";

/** Seconds a customer waits before asking for another code. */
export const OTP_RESEND_SECONDS = 30;
export const OTP_LENGTH = 6;

/** 10-digit Indian mobile number; spaces, dashes and +91 / 0 are stripped. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

export const otpSchema = z.string().trim().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`);

export const profileSchema = z.object({
  name: z.string().trim().max(80, "Name is too long").default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
    .default(""),
});

const text = (label: string, max = 80) =>
  z.string().trim().min(1, `Enter the ${label}`).max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long`);

export const addressSchema = z.object({
  firstName: text("first name", 50),
  lastName: text("last name", 50),
  line1: text("address", 160),
  line2: z.string().trim().max(160).default(""),
  city: text("city", 60),
  state: z.enum(INDIAN_STATES, "Select the state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const MAX_SAVED_ADDRESSES = 10;

/** What the account API returns for the signed-in customer. */
export interface AccountData {
  phone: string;
  name: string;
  email: string;
  addresses: (AddressInput & { id: string })[];
  defaultAddressId: string | null;
}

/** "Test Buyer, 12 Test Street, Kochi, Kerala 682001" */
export function formatAddress(a: AddressInput) {
  return [`${a.firstName} ${a.lastName}`.trim(), a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`]
    .filter(Boolean)
    .join(", ");
}
