import { Reveal } from "@/components/ui/Reveal";

const pillars = [
  {
    number: "01",
    title: "Fit",
    copy: "Every pattern is graded and re-tested across sizes so proportions stay correct, not just scaled.",
  },
  {
    number: "02",
    title: "Fabric",
    copy: "Heavyweight, long-staple cottons sourced for density and drape — built to hold shape wash after wash.",
  },
  {
    number: "03",
    title: "Form",
    copy: "Clean silhouettes with no unnecessary hardware, prints, or branding. The cut does the talking.",
  },
  {
    number: "04",
    title: "Function",
    copy: "Reinforced seams, pre-shrunk construction, and finishes designed for daily wear, not display.",
  },
];

export function Philosophy() {
  return (
    <section className="bg-ink px-5 py-28 text-paper md:px-10 md:py-36">
      <div>
        <Reveal>
          <span className="mb-3 block text-xs uppercase tracking-widest2 text-taupe">The NSUDE Standard</span>
          <h2 className="mb-16 max-w-2xl text-display-md font-medium uppercase tracking-tighter text-paper md:mb-24">
            Four things we never compromise on
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-4">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.1}>
              <div className="flex flex-col gap-4 border-t border-taupe/40 pt-6">
                <span className="text-xs text-sand">{pillar.number}</span>
                <h3 className="text-2xl font-medium uppercase tracking-tighter">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-mist">{pillar.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
