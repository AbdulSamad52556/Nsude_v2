import Link from "next/link";
import { Lock } from "lucide-react";
import { pageAdmin } from "@/lib/server/auth";
import { firstAllowedPage } from "@/lib/adminPermissions";

export const metadata = { title: "No access" };

/** Where admin pages send someone whose permissions don't cover them. */
export default async function NoAccessPage() {
  const home = firstAllowedPage(await pageAdmin());
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand/50 text-moss">
        <Lock size={20} strokeWidth={1.5} />
      </span>
      <h1 className="mt-5 text-xl font-medium uppercase tracking-tighter">No access</h1>
      <p className="mt-2 text-sm text-graphite">
        Your account doesn&apos;t have permission to open that page. Ask the super admin if you need it.
      </p>
      {home && (
        <Link
          href={home}
          className="mt-6 flex h-10 items-center rounded-md bg-moss px-5 text-xs uppercase tracking-widest2 text-paper hover:brightness-90"
        >
          Go back
        </Link>
      )}
    </div>
  );
}
