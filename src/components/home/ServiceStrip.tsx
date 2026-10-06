import { Banknote, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/checkout";
import { formatPrice } from "@/lib/utils";
import { Reveal } from "@/components/ui/Reveal";

const services = [
  { icon: Truck, title: "Free shipping", copy: `On orders over ${formatPrice(FREE_SHIPPING_THRESHOLD)}, across India` },
  { icon: RotateCcw, title: "14-day returns", copy: "Easy returns on unworn pieces with tags" },
  { icon: Banknote, title: "Cash on delivery", copy: "Pay when your order arrives" },
  { icon: ShieldCheck, title: "Secure payment", copy: "UPI, cards and netbanking via Razorpay" },
];

/** What every order comes with — the last thing before the footer. */
export function ServiceStrip() {
  return (
    <section className="border-t border-taupe/30 bg-paper px-5 py-14 md:px-10 md:py-20">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {services.map(({ icon: Icon, title, copy }, i) => (
          <li key={title}>
            <Reveal delay={i * 0.06} className="flex flex-col items-start gap-3 md:flex-row md:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand/50 text-ink">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest2 text-ink">{title}</p>
                <p className="mt-1.5 text-sm leading-snug text-ash">{copy}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
