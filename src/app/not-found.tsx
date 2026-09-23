import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-content flex-col items-center justify-center gap-6 px-5 text-center">
      <span className="text-xs uppercase tracking-widest2 text-ash">404</span>
      <h1 className="text-display-md font-medium uppercase tracking-tighter text-ink">
        Page Not Found
      </h1>
      <p className="max-w-sm text-sm text-graphite">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="group inline-flex items-center gap-2 border-b border-ink pb-1 text-sm uppercase tracking-widest2 text-ink"
      >
        Back to Home
        <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
