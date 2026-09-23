import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How NSUDE collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div>
      <PageHeader title="Privacy Policy" />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pb-28 text-sm leading-relaxed text-graphite md:px-10 md:text-base">
        <p>
          NSUDE collects only the information necessary to process orders,
          respond to inquiries, and improve the shopping experience —
          including name, shipping address, email, and order history.
        </p>
        <p>
          We never sell your personal data to third parties. Information is
          shared only with the payment and logistics partners required to
          fulfill your order.
        </p>
        <p>
          You may request a copy of your data or ask us to delete it at any
          time by emailing hello@nsude.com.
        </p>
      </div>
    </div>
  );
}
