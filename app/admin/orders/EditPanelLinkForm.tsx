'use client';

import { useState } from 'react';
import { updatePanelLinkByCredentialAction } from './actions';

/** Change which pcity.online panel link a delivered Crunchyroll item uses. */
export function EditPanelLinkForm({ inventoryItemId, token }: { inventoryItemId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = `https://pcity.online/c/${token}`;

  return (
    <div className="mt-1.5">
      {!open && (
        <p className="break-all text-[10px] text-slate-500">
          Panel link: <a href={current} target="_blank" className="text-slate-400 underline-offset-2 hover:underline">{current}</a>
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMsg(null);
          }}
          className="mt-1 rounded border border-orange-500/40 px-2 py-0.5 text-[11px] font-semibold text-orange-300 hover:bg-orange-500/10"
        >
          Edit panel link
        </button>
      ) : (
        <form
          action={async (fd) => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await updatePanelLinkByCredentialAction(fd);
              if (r.ok) {
                setMsg({ ok: true, text: 'Updated. The customer sees the new link now.' });
                setOpen(false);
              } else setMsg({ ok: false, text: r.error || 'Could not update.' });
            } catch {
              setMsg({ ok: false, text: 'Could not update — try again.' });
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1 space-y-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.04] p-2.5"
        >
          <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
          <input
            name="link"
            defaultValue={current}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-orange-400"
          />
          <p className="text-[10px] text-slate-500">
            Make or renew the customer&apos;s link on pcity.online/admin, then paste it here.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="flex-1 rounded border border-slate-700 py-1.5 text-[11px] text-slate-300">
              Cancel
            </button>
            <button disabled={busy} className="flex-1 rounded bg-orange-500 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
              {busy ? 'Saving…' : 'Save link'}
            </button>
          </div>
        </form>
      )}
      {msg && <p className={`mt-1 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
    </div>
  );
}
