"use client";

import { motion, useReducedMotion } from "framer-motion";

interface AnimatedTextProps {
  text: string;
  className?: string;
  by?: "word" | "line";
  delay?: number;
  once?: boolean;
  as?: "h1" | "h2" | "h3" | "p";
}

export function AnimatedText({
  text,
  className,
  by = "word",
  delay = 0,
  once = true,
  as = "h2",
}: AnimatedTextProps) {
  const shouldReduceMotion = useReducedMotion();
  const units = by === "word" ? text.split(" ") : text.split("\n");
  const Tag = as;

  if (shouldReduceMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: "-10% 0px -10% 0px" }}
        transition={{ staggerChildren: 0.045, delayChildren: delay }}
        className="inline"
      >
        {units.map((unit, i) => (
          <span key={i} className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              variants={{
                hidden: { y: "110%" },
                visible: {
                  y: "0%",
                  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              {unit}
              {by === "word" ? " " : ""}
            </motion.span>
            {by === "line" && <br />}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
