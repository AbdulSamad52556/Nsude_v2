"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { formatPaise } from "@/lib/finance";
import { inputClass } from "./Dialog";
import { apiFetch } from "./api";

type Child = { id: string; name: string; active: boolean };
type Category = { id: string; name: string; active: boolean; children: Child[] };
type Usage = Record<string, { count: number; paise?: number }>;

/**
 * Add, rename, hide or delete categories and their sub-categories — used for
 * expense categories (Finance) and shop categories (Products).
 */
export function CategoryManager({
  tree,
  usage,
  canManage,
  apiBase,
  unit,
  placeholder,
  note,
}: {
  tree: Category[];
  usage: Usage;
  canManage: boolean;
  /** e.g. "/api/admin/finance/categories" */
  apiBase: string;
  /** What uses a category, singular: "expense", "product". */
  unit: string;
  placeholder: string;
  note: string;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const add = (name: string, parentId?: string) =>
    run(`add-${parentId ?? "top"}`, () =>
      apiFetch(apiBase, { method: "POST", body: JSON.stringify({ name, parentId }) })
    );
  const patch = (id: string, body: object) =>
    run(id, () => apiFetch(`${apiBase}/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
  const remove = (id: string, label: string) =>
    window.confirm(`Delete "${label}"?`) &&
    run(id, () => apiFetch(`${apiBase}/${id}`, { method: "DELETE" }));

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (newName.trim() && (await add(newName.trim()))) setNewName("");
          }}
          className="flex max-w-lg gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={placeholder}
            maxLength={40}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!newName.trim() || busy !== null}
            className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-ink px-5 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite disabled:opacity-50"
          >
            {busy === "add-top" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={1.5} />} Add
          </button>
        </form>
      )}
      {error && <p className="text-xs text-rust">{error}</p>}

      <ul className="divide-y divide-taupe/20 overflow-hidden rounded-lg border border-taupe/30">
        {tree.map((c) => {
          const expanded = open.has(c.id);
          const own = usage[c.id] ?? { count: 0, paise: 0 };
          return (
            <li key={c.id} className={cx(!c.active && "bg-sand/15")}>
              <Row
                name={c.name}
                active={c.active}
                count={own.count}
                paise={own.paise}
                unit={unit}
                busy={busy === c.id}
                canManage={canManage}
                onRename={(name) => patch(c.id, { name })}
                onToggle={() => patch(c.id, { active: !c.active })}
                onDelete={() => remove(c.id, c.name)}
                lead={
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((s) => {
                        const n = new Set(s);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                    aria-expanded={expanded}
                    aria-label={expanded ? `Hide ${c.name} sub-categories` : `Show ${c.name} sub-categories`}
                    className="flex h-7 w-7 items-center justify-center rounded text-ash hover:bg-sand/40 hover:text-ink"
                  >
                    <ChevronRight size={15} strokeWidth={1.5} className={cx("transition-transform", expanded && "rotate-90")} />
                  </button>
                }
                extra={c.children.length > 0 ? `${c.children.length} sub` : undefined}
              />
              {expanded && (
                <div className="border-t border-taupe/15 bg-paper pb-3 pl-12 pr-4">
                  <ul>
                    {c.children.map((s) => {
                      const u = usage[s.id] ?? { count: 0, paise: 0 };
                      return (
                        <li key={s.id} className="border-b border-taupe/10 last:border-0">
                          <Row
                            name={s.name}
                            active={s.active}
                            count={u.count}
                            paise={u.paise}
                            unit={unit}
                            busy={busy === s.id}
                            canManage={canManage}
                            small
                            onRename={(name) => patch(s.id, { name })}
                            onToggle={() => patch(s.id, { active: !s.active })}
                            onDelete={() => remove(s.id, `${c.name} › ${s.name}`)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  {c.children.length === 0 && <p className="py-2 text-xs text-ash">No sub-categories yet.</p>}
                  {canManage && <AddSub onAdd={(name) => add(name, c.id)} busy={busy === `add-${c.id}`} parent={c.name} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ash">{note}</p>
    </div>
  );
}

function Row({
  name,
  active,
  count,
  paise,
  unit,
  busy,
  canManage,
  small,
  lead,
  extra,
  onRename,
  onToggle,
  onDelete,
}: {
  name: string;
  active: boolean;
  count: number;
  paise?: number;
  unit: string;
  busy: boolean;
  canManage: boolean;
  small?: boolean;
  lead?: React.ReactNode;
  extra?: string;
  onRename: (name: string) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const icon = "flex h-8 w-8 items-center justify-center rounded text-ash hover:bg-sand/40 hover:text-ink disabled:opacity-40";

  return (
    <div className={cx("flex items-center gap-2", small ? "py-2" : "px-3 py-3")}>
      {lead}
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (value.trim() && (await onRename(value.trim()))) setEditing(false);
          }}
        >
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} autoFocus className={cx(inputClass, "h-9")} />
          <button type="submit" className="h-9 rounded-md bg-ink px-3 text-[11px] uppercase tracking-widest2 text-paper">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 px-2 text-[11px] uppercase tracking-widest2 text-ash">
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={cx("truncate", small ? "text-sm" : "text-sm font-medium", !active && "text-ash line-through")}>
              {name}
              {!active && <span className="ml-2 text-[10px] uppercase tracking-wide no-underline">hidden</span>}
            </p>
            <p className="text-[11px] text-ash">
              {count ? `${count} ${unit}${count === 1 ? "" : "s"}${paise !== undefined ? ` · ${formatPaise(paise)}` : ""}` : "Not used yet"}
              {extra && ` · ${extra}`}
            </p>
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center">
              {busy && <Loader2 size={14} className="mr-2 animate-spin text-ash" />}
              <button type="button" onClick={() => setEditing(true)} title="Rename" aria-label={`Rename ${name}`} className={icon}>
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button type="button" onClick={onToggle} title={active ? "Hide" : "Show"} aria-label={active ? `Hide ${name}` : `Show ${name}`} className={icon}>
                {active ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
              </button>
              <button type="button" onClick={onDelete} disabled={count > 0} title={count > 0 ? "In use — hide it instead" : "Delete"} aria-label={`Delete ${name}`} className={cx(icon, "hover:text-rust")}>
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddSub({ onAdd, busy, parent }: { onAdd: (name: string) => Promise<boolean>; busy: boolean; parent: string }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim() && (await onAdd(name.trim()))) setName("");
      }}
      className="mt-2 flex max-w-md gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`New sub-category of ${parent}`}
        maxLength={40}
        className={cx(inputClass, "h-9")}
      />
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-taupe/60 px-3 text-[11px] uppercase tracking-widest2 text-ink hover:border-ink disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={1.5} />} Add
      </button>
    </form>
  );
}
