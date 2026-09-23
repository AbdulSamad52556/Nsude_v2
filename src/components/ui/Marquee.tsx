export function Marquee({ text }: { text: string }) {
  const items = new Array(6).fill(text);
  return (
    <div className="relative flex overflow-hidden border-y border-graphite/20 py-4">
      <div className="flex shrink-0 animate-marquee gap-8 motion-reduce:animate-none">
        {items.map((t, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-sm uppercase tracking-widest2 text-ash"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 animate-marquee gap-8 motion-reduce:animate-none" aria-hidden>
        {items.map((t, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-sm uppercase tracking-widest2 text-ash"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
