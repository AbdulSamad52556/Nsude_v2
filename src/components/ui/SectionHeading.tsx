import { cx } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {eyebrow && (
        <Reveal>
          <span className="text-xs uppercase tracking-widest2 text-ash">
            {eyebrow}
          </span>
        </Reveal>
      )}
      <Reveal delay={0.08}>
        <h2 className="text-display-md font-sans font-medium uppercase tracking-tighter text-ink">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={0.16}>
          <p
            className={cx(
              "max-w-md text-sm leading-relaxed text-graphite md:text-base",
              align === "center" && "mx-auto"
            )}
          >
            {subtitle}
          </p>
        </Reveal>
      )}
    </div>
  );
}
