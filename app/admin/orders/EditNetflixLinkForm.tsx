'use client';

import { useState } from 'react';
import { updateNetflixLinkByCredentialAction } from './actions';

/** Replace the supplier link on a delivered Netflix item. Collapsed by default. */
export function EditNetflixLinkForm({
  inventoryItemId,
  link,
  note,
}: {
  inventoryItemId: string;
  link: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const input =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-red-400';

  async function submit(formData: FormData) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await updateNetflixLinkByCredentialAction(formData);
      if (res.ok) {
        setMsg({ ok: true, text: 'Link updated. Customer sees it now.' });
        setOpen(false);
      } else {
        setMsg({ ok: false, text: res.error || 'Could not update.' });
      }
    } catch {
      setMsg({ ok: false, text: 'Could not update — try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5">
      {link && !open && (
        <p className="break-all text-[10px] text-slate-500">
          Link: <span className="text-slate-400">{link}</span>
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMsg(null);
          }}
          className="mt-1 rounded border border-red-500/40 px-2 py-0.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/10"
        >
          Edit supplier link
        </button>
      ) : (
        <form action={submit} className="mt-1 space-y-2 rounded-lg border border-red-500/30 bg-red-500/[0.04] p-2.5">
          <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Supplier link</span>
            <input name="link" defaultValue={link} className={input} autoComplete="off" required />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Note (shown to customer)</span>
            <textarea name="note" defaultValue={note} rows={2} className={input} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="flex-1 rounded border border-slate-700 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded bg-red-500 py-1.5 text-[11px] font-bold text-white hover:bg-red-400 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save link'}
            </button>
          </div>
        </form>
      )}
      {msg && <p className={`mt-1 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
    </div>
  );
}
