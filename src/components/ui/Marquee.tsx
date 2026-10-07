/** Endless strip of phrases (black band, off-white text, sand dots). */
export function Marquee({ items }: { items: string[] }) {
  const row = Array.from({ length: 4 }, () => items).flat();
  const strip = (hidden?: boolean) => (
    <div className="flex shrink-0 animate-marquee items-center motion-reduce:animate-none" aria-hidden={hidden || undefined}>
      {row.map((t, i) => (
        <span key={i} className="flex items-center whitespace-nowrap text-xs uppercase tracking-widest2 text-paper md:text-sm">
          <span className="px-6 md:px-8">{t}</span>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sand" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative flex overflow-hidden bg-ink py-3.5 md:py-4">
      {strip()}
      {strip(true)}
    </div>
  );
}
