export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-content px-5 pb-16 pt-32 md:px-10 md:pt-40">
      <h1 className="text-display-lg font-medium uppercase tracking-tighter text-ink">
        {title}
      </h1>
      {subtitle && <p className="mt-4 max-w-lg text-sm text-graphite md:text-base">{subtitle}</p>}
    </div>
  );
}
