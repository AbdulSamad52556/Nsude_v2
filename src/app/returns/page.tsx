import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Returns",
  description: "How to return or exchange an NSUDE order.",
};

export default function ReturnsPage() {
  return (
    <div>
      <PageHeader title="Returns" subtitle="Simple, no-hassle returns within 14 days of delivery." />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pb-28 text-sm leading-relaxed text-graphite md:px-10 md:text-base">
        <ol className="flex flex-col gap-6">
          <li>
            <span className="mb-1 block text-xs uppercase tracking-widest2 text-ink">
              01 — Request
            </span>
            Email hello@nsude.com with your order number and the item you&apos;d
            like to return within 14 days of delivery.
          </li>
          <li>
            <span className="mb-1 block text-xs uppercase tracking-widest2 text-ink">
              02 — Pack
            </span>
            Pack the item, unworn and unwashed, with tags attached, in its
            original packaging where possible.
          </li>
          <li>
            <span className="mb-1 block text-xs uppercase tracking-widest2 text-ink">
              03 — Ship
            </span>
            We&apos;ll send a prepaid return label for domestic orders within
            India.
          </li>
          <li>
            <span className="mb-1 block text-xs uppercase tracking-widest2 text-ink">
              04 — Refund
            </span>
            Once received and inspected, refunds are issued to your original
            payment method within 5–7 business days.
          </li>
        </ol>
      </div>
    </div>
  );
}
