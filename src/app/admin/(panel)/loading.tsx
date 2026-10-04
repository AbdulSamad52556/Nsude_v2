/**
 * Shown the moment an admin page is opened, while its data loads; the
 * sidebar stays in place. Next.js also prefetches up to here, so the switch
 * feels instant.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-8 border-b border-taupe/30 pb-6">
        <span className="mb-3 block h-0.5 w-8 bg-sand" />
        <div className="h-8 w-48 rounded-md bg-sand/50" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-sand/30" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-taupe/30 p-4">
            <div className="h-2.5 w-16 rounded bg-sand/40" />
            <div className="mt-3 h-6 w-10 rounded bg-sand/50" />
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 w-20 rounded-md border border-taupe/30" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-taupe/30">
        <div className="h-10 bg-sand/30" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-taupe/20 p-3">
            <div className="h-4 w-1/4 rounded bg-sand/40" />
            <div className="h-4 w-1/5 rounded bg-sand/30" />
            <div className="h-4 w-1/6 rounded bg-sand/30" />
            <div className="ml-auto h-4 w-16 rounded bg-sand/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
