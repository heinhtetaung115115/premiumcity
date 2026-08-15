'use client';

import { useState } from 'react';
import { adminCreditWalletAction } from './actions';

export function AdminTopupForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt > 0 && reason.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('amount', String(Math.round(amt)));
    fd.set('reason', reason.trim());

    const res = await adminCreditWalletAction(fd);
    setBusy(false);
    setConfirming(false);

    if (res.ok) {
      setMsg({
        ok: true,
        text: `Credited ${Math.round(amt).toLocaleString('en-US')} Ks. New balance: ${(res.balance ?? 0).toLocaleString('en-US')} Ks.`,
      });
      setAmount('');
      setReason('');
    } else {
      setMsg({ ok: false, text: res.error || 'Could not credit the wallet.' });
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <p className="text-sm font-semibold text-amber-200">Manual top-up</p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Credits this user&apos;s wallet directly. Creates their wallet if they don&apos;t have one
        yet. Every credit is logged with your reason.
      </p>

      <div className="mt-3 space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Amount (Ks)</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setMsg(null);
              setConfirming(false);
            }}
            placeholder="e.g. 16000"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setMsg(null);
              setConfirming(false);
            }}
            placeholder="e.g. KBZ slip verified manually — gateway failed"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
          />
        </div>

        {!confirming ? (
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => setConfirming(true)}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Credit wallet
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-100">
              Credit <span className="font-bold">{Math.round(amt).toLocaleString('en-US')} Ks</span> to
              this user? This happens immediately.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-slate-600 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Crediting…' : 'Yes, credit'}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p
            className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}
          >
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
