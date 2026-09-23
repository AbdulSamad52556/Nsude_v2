import { AnimatedText } from "@/components/ui/AnimatedText";
import { Reveal } from "@/components/ui/Reveal";

export function BrandStatement() {
  return (
    <section className="bg-paper px-5 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-content">
        <AnimatedText
          as="h2"
          by="line"
          text={"We don't make more clothes.\nWe make the ones you keep."}
          className="max-w-4xl text-display-lg font-medium uppercase tracking-tighter text-ink"
        />
        <Reveal delay={0.3}>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-graphite md:text-base">
            NSUDE exists against the churn — fewer releases, better fabric,
            fit tested until it disappears on the body. Every tee is designed
            to outlast the season it was made for.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
