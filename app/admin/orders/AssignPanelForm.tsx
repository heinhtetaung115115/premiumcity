'use client';

import { useState } from 'react';
import { deliverPanelSlotAction } from './actions';

type Sugg = { id: string; email: string; used: number; max: number };

/** Deliver a Crunchyroll (account panel) profile slot to a manual order item. */
export function AssignPanelForm({
  orderItemId,
  suggestions,
  defaultProfile,
  defaultDays,
}: {
  orderItemId: string;
  suggestions: Sugg[];
  defaultProfile: string;
  defaultDays: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-orange-400';

  if (suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
        No free profile slots — add an account in the account panel (pcity.online/admin) first.
      </p>
    );
  }

  return (
    <form
      action={async (fd) => {
        setBusy(true);
        setMsg(null);
        try {
          const r = await deliverPanelSlotAction(fd);
          setMsg(r.ok ? { ok: true, text: `Delivered ✓ ${r.linkUrl ?? ''}` } : { ok: false, text: r.error || 'Failed' });
        } catch {
          setMsg({ ok: false, text: 'Failed — try again.' });
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.05] p-3"
    >
      <p className="text-[11px] font-semibold text-orange-200">🎯 Deliver a profile from the account panel</p>
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <select name="accountId" required defaultValue={suggestions[0]?.id} className={input}>
        {suggestions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.email} — {s.used}/{s.max} used
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <input name="profileName" defaultValue={defaultProfile} placeholder="Profile name" className={input} />
        <input name="profilePin" placeholder="PIN (optional)" className={input} />
        <input name="days" type="number" min={1} defaultValue={defaultDays} title="Warranty days" className={input} />
      </div>
      <p className="text-[10px] text-slate-500">Create this profile in the account first, then deliver.</p>
      <button
        disabled={busy}
        className="w-full rounded-md bg-orange-500 py-1.5 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-50"
      >
        {busy ? 'Delivering…' : 'Deliver profile'}
      </button>
      {msg && <p className={`break-all text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
    </form>
  );
}
