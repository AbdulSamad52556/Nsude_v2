import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing purchases made through the NSUDE website.",
};

export default function TermsPage() {
  return (
    <div>
      <PageHeader title="Terms of Service" />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pb-28 text-sm leading-relaxed text-graphite md:px-10 md:text-base">
        <p>
          By placing an order with NSUDE, you agree to provide accurate
          billing and shipping information and to pay the listed price for
          any items ordered, including applicable shipping.
        </p>
        <p>
          All product descriptions, imagery, and pricing are subject to
          change without notice. We reserve the right to limit quantities
          and refuse orders at our discretion.
        </p>
        <p>
          All content on this site — including photography, text, and the
          NSUDE name and wordmark — is the property of NSUDE and may not be
          reproduced without permission.
        </p>
      </div>
    </div>
  );
}
