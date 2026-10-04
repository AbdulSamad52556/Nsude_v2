import Link from "next/link";
import type { AuditLog } from "@prisma/client";
import { cx } from "@/lib/utils";

const ACTOR_TONE: Record<string, string> = {
  admin: "bg-ink text-paper",
  customer: "bg-moss/10 text-moss",
  system: "bg-sand/50 text-ink",
};
const ACTOR_LABEL: Record<string, string> = { admin: "Admin", customer: "Customer", system: "System" };

/** Where the thing an entry is about lives in admin. */
export function entityHref(e: Pick<AuditLog, "entity" | "entityId">) {
  if (e.entity === "customer") return `/admin/customers/${e.entityId}`;
  if (e.entity === "product") return `/admin/products/${e.entityId}`;
  if (e.entity === "order") return `/admin/orders/${e.entityId}`;
  if (e.entity === "hero") return "/admin/hero";
  if (e.entity === "admin_user") return `/admin/users/${e.entityId}`;
  if (e.entity === "finance") return `/admin/finance/ledger?entry=${e.entityId}`;
  return null;
}

export const auditTime = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/**
 * Edit history entries, newest first: when, who (admin / customer / system),
 * what, and each changed field as old → new.
 */
export function AuditList({
  entries,
  showEntity = true,
  empty = "No changes recorded yet.",
}: {
  entries: AuditLog[];
  /** Hide the "what was changed" link when the page is already about it. */
  showEntity?: boolean;
  empty?: string;
}) {
  if (entries.length === 0) {
    return <p className="rounded-lg border border-taupe/30 p-6 text-sm text-graphite">{empty}</p>;
  }
  return (
    <ol className="rounded-lg divide-y divide-taupe border border-taupe/60 overflow-hidden">
      {entries.map((e) => {
        const href = entityHref(e);
        return (
          <li key={e.id} className="p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <time className="text-xs text-ash" dateTime={e.at.toISOString()}>
                {auditTime(e.at)}
              </time>
              <span className={cx("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", ACTOR_TONE[e.actorType])}>
                {ACTOR_LABEL[e.actorType] ?? e.actorType}
              </span>
              <span className="text-xs text-graphite">{e.actorLabel}</span>
            </div>
            <p className="mt-2 text-sm">
              <span className="font-medium">{e.action}</span>
              {showEntity && (
                <>
                  {" · "}
                  {href ? (
                    <Link href={href} className="underline-offset-4 hover:underline">
                      {e.entityLabel}
                    </Link>
                  ) : (
                    e.entityLabel
                  )}
                </>
              )}
            </p>
            {e.changes.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <tbody className="divide-y divide-taupe/20">
                    {e.changes.map((c, i) => (
                      <tr key={i}>
                        <td className="w-1/3 py-1.5 pr-3 align-top text-ash">{c.field}</td>
                        <td className="py-1.5 pr-3 align-top text-graphite">
                          {c.from === "—" ? <span className="text-mist">—</span> : <span className="line-through decoration-rust/50">{c.from}</span>}
                        </td>
                        <td className="w-6 py-1.5 align-top text-ash">→</td>
                        <td className="py-1.5 align-top text-ink">{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
