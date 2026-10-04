import { Eye } from "lucide-react";

/**
 * Shows an editor without letting it be used: a disabled fieldset turns off
 * every input and button inside. The API refuses changes anyway; this just
 * makes "view only" obvious.
 */
export function ReadOnly({
  when,
  note = true,
  children,
}: {
  when: boolean;
  /** Show the "View only" banner (off when the page explains it itself). */
  note?: boolean;
  children: React.ReactNode;
}) {
  if (!when) return <>{children}</>;
  return (
    <div>
      {note && (
        <p className="mb-6 flex items-center gap-2 rounded-md bg-sand/40 px-3 py-2 text-xs text-ink">
          <Eye size={14} strokeWidth={1.5} /> View only. Ask the super admin if you need to make changes.
        </p>
      )}
      <fieldset disabled className="pointer-events-none select-text opacity-80">
        {children}
      </fieldset>
    </div>
  );
}
