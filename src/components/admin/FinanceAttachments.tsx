"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Paperclip, Plus, X } from "lucide-react";
import { cx } from "@/lib/utils";
import { Dialog } from "./Dialog";
import { ApiError, apiFetch } from "./api";

export type Attachment = { url: string; publicId: string; name: string; kind: "image" | "pdf"; resourceType: "image" | "raw" };

export const MAX_ATTACHMENTS = 5;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Uploads one bill / receipt and returns it (not attached to anything yet). */
async function uploadBill(file: File): Promise<Attachment> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/finance/receipt", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Upload failed", res.status);
  return data.attachment as Attachment;
}

function FileChip({ file, onRemove }: { file: Attachment; onRemove?: () => void }) {
  const Icon = file.kind === "pdf" ? FileText : ImageIcon;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-taupe/50 bg-paper py-1 pl-2 pr-1 text-xs">
      <Icon size={13} strokeWidth={1.5} className="shrink-0 text-ash" />
      <a href={file.url} target="_blank" rel="noreferrer" className="truncate underline-offset-2 hover:underline">
        {file.name}
      </a>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="p-0.5 text-ash hover:text-rust">
          <X size={13} strokeWidth={1.5} />
        </button>
      )}
    </span>
  );
}

/** For a new entry: pick photos / PDFs of the bill; they upload straight away. */
export function BillPicker({ value, onChange }: { value: Attachment[]; onChange: (files: Attachment[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_ATTACHMENTS - value.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Up to ${MAX_ATTACHMENTS} files per entry.`);
    setBusy(true);
    const done: Attachment[] = [];
    for (const f of chosen) {
      try {
        done.push(await uploadBill(f));
      } catch (err) {
        setError((err as Error).message);
      }
    }
    onChange([...value, ...done]);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-ash">Bills / receipts (optional)</span>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((f) => (
          <FileChip key={f.publicId} file={f} onRemove={() => onChange(value.filter((x) => x.publicId !== f.publicId))} />
        ))}
        {value.length < MAX_ATTACHMENTS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-taupe px-3 text-[11px] uppercase tracking-widest2 text-graphite hover:border-ink hover:text-ink disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} strokeWidth={1.5} />}
            {busy ? "Uploading…" : "Add photo or PDF"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => pick(e.target.files)} />
      {error ? (
        <p className="mt-1 text-xs text-rust">{error}</p>
      ) : (
        <p className="mt-1 text-[11px] text-ash">JPG, PNG, WebP or PDF · up to 10 MB each · {MAX_ATTACHMENTS} files max</p>
      )}
    </div>
  );
}

/**
 * Ledger cell: how many bills an entry has; opens them, and (with Finance:
 * manage) adds more or removes a wrong one.
 */
export function EntryBills({ entryId, files, canManage }: { entryId: string; files: Attachment[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (files.length === 0 && !canManage) return <span className="text-ash">—</span>;

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    try {
      const room = MAX_ATTACHMENTS - files.length;
      const uploaded: Attachment[] = [];
      for (const f of Array.from(list).slice(0, room)) uploaded.push(await uploadBill(f));
      if (uploaded.length) await apiFetch(`/api/admin/finance/${entryId}`, { method: "PATCH", body: JSON.stringify({ attach: uploaded }) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(publicId: string) {
    if (!window.confirm("Remove this file from the entry?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/finance/${entryId}`, { method: "PATCH", body: JSON.stringify({ removeAttachment: publicId }) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={files.length ? `${files.length} bill${files.length === 1 ? "" : "s"}` : "Attach bill"}
        className={cx(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors",
          files.length ? "bg-sand/50 text-ink hover:bg-sand" : "text-ash hover:bg-sand/30 hover:text-ink"
        )}
      >
        <Paperclip size={13} strokeWidth={1.5} />
        {files.length ? files.length : <Plus size={11} strokeWidth={2} />}
      </button>
      <Dialog open={open} title="Bills / receipts" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          {files.length === 0 ? (
            <p className="text-sm text-graphite">No bills attached yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {files.map((f) => (
                <li key={f.publicId} className="flex items-center justify-between gap-3 rounded-md border border-taupe/40 p-2">
                  <a href={f.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                    {f.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-sand/40 text-ink">
                        <FileText size={18} strokeWidth={1.5} />
                      </span>
                    )}
                    <span className="truncate">{f.name}</span>
                  </a>
                  {canManage && (
                    <button type="button" onClick={() => remove(f.publicId)} disabled={busy} className="p-1.5 text-ash hover:text-rust" aria-label={`Remove ${f.name}`}>
                      <X size={15} strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && files.length < MAX_ATTACHMENTS && (
            <>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-dashed border-taupe text-xs uppercase tracking-widest2 text-graphite hover:border-ink hover:text-ink disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} strokeWidth={1.5} />}
                {busy ? "Working…" : "Attach photo or PDF"}
              </button>
              <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => add(e.target.files)} />
            </>
          )}
          {error && <p className="text-xs text-rust">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
