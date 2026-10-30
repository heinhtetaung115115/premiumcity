'use client';

import { useState } from 'react';
import { updateDeliveredCredentialAction } from './actions';

/**
 * Edit the email/password of an account already delivered on an order
 * (warranty replacements). Collapsed by default to keep the order list tidy.
 */
export function EditCredentialForm({
  inventoryItemId,
  email,
  password,
  note,
}: {
  inventoryItemId: string;
  email: string;
  password: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const input =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500';

  async function submit(formData: FormData) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await updateDeliveredCredentialAction(formData);
      if (!res.ok) {
        setMsg({ ok: false, text: res.error || 'Could not update.' });
      } else if (res.emailed) {
        setMsg({ ok: true, text: 'Updated. Customer was emailed.' });
        setOpen(false);
      } else {
        setMsg({ ok: true, text: res.error || 'Updated. No email sent.' });
        setOpen(false);
      }
    } catch {
      setMsg({ ok: false, text: 'Could not update — try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMsg(null);
          }}
          className="rounded border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/10"
        >
          Edit account
        </button>
      ) : (
        <form action={submit} className="mt-1 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-2.5">
          <input type="hidden" name="inventoryItemId" value={inventoryItemId} />

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Email</span>
              <input name="email" defaultValue={email} className={input} autoComplete="off" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Password</span>
              <input name="password" defaultValue={password} className={input} autoComplete="off" />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Note (shown to customer and in the email)
            </span>
            <textarea name="note" defaultValue={note} rows={2} className={input} />
          </label>

          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" name="notify" defaultChecked />
            Email the customer that their account was updated
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
              className="flex-1 rounded bg-amber-500 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p className={`mt-1 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>
      )}
    </div>
  );
}
