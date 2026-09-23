import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "NSUDE shipping timelines, costs, and return policy.",
};

export default function ShippingPage() {
  return (
    <div>
      <PageHeader title="Shipping & Returns" />
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pb-28 text-sm leading-relaxed text-graphite md:px-10 md:text-base">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest2 text-ink">Shipping</h2>
          <p>
            Orders are processed within 1–2 business days. Standard shipping
            across India takes 3–6 business days and is free on orders over
            ₹2,999; otherwise a flat rate of ₹149 applies. Tracking details
            are emailed once your order ships.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest2 text-ink">Returns</h2>
          <p>
            We accept returns within 14 days of delivery on unworn,
            unwashed items with original tags attached. To start a return,
            email hello@nsude.com with your order number. Refunds are
            issued to the original payment method within 5–7 business days
            of receiving the returned item.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest2 text-ink">Exchanges</h2>
          <p>
            Need a different size or color? Request an exchange the same
            way as a return — we&apos;ll prioritize dispatch of the new item
            once the original is received.
          </p>
        </section>
      </div>
    </div>
  );
}
