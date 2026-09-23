import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccordionItem } from "@/components/product/Accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about NSUDE sizing, shipping, and care.",
};

const faqs = [
  {
    q: "How does NSUDE fit run?",
    a: "Our Regular fit is true to size. Oversized and Boxy fits are cut generously — size down if you prefer a closer silhouette. Full measurements are listed on every product page.",
  },
  {
    q: "What fabric do you use?",
    a: "Primarily combed and Pima cotton between 180–260 GSM depending on the style, chosen for density, drape, and durability over repeated washes.",
  },
  {
    q: "How long does shipping take?",
    a: "Orders ship within 1–2 business days and arrive within 3–6 business days across India. Shipping is free on orders over ₹2,999.",
  },
  {
    q: "What is your return policy?",
    a: "We accept returns within 14 days of delivery on unworn items with tags attached. See our Returns page for the full policy.",
  },
  {
    q: "How do I care for my NSUDE pieces?",
    a: "Machine wash cold with like colors, avoid bleach, and tumble dry low. This preserves both the color and the density of the fabric.",
  },
];

export default function FaqPage() {
  return (
    <div>
      <PageHeader title="FAQ" subtitle="Everything you need to know before you order." />
      <div className="mx-auto max-w-2xl px-5 pb-28 md:px-10">
        {faqs.map((item) => (
          <AccordionItem key={item.q} title={item.q}>
            {item.a}
          </AccordionItem>
        ))}
      </div>
    </div>
  );
}
