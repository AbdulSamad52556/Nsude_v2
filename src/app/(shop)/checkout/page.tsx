import { CheckoutView } from "@/components/checkout/CheckoutView";
import { razorpayEnabled } from "@/lib/server/razorpay";

export const metadata = { title: "Checkout", robots: { index: false } };

// Rendered per request so the payment options follow the current .env.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutView razorpayEnabled={razorpayEnabled()} />;
}
