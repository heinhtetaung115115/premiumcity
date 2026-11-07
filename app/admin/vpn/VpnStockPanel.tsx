'use client';

import { useState } from 'react';

type Row = { country: string; manualInStock: boolean; hasServer: boolean; inStock: boolean };

const FLAGS: Record<string, string> = {
  JP: '🇯🇵', SG: '🇸🇬', TH: '🇹🇭', US: '🇺🇸', HK: '🇭🇰', KR: '🇰🇷', DE: '🇩🇪', GB: '🇬🇧',
  IN: '🇮🇳', ID: '🇮🇩', MY: '🇲🇾', VN: '🇻🇳', TW: '🇹🇼', AU: '🇦🇺', NL: '🇳🇱', FR: '🇫🇷',
};
const NAMES: Record<string, string> = {
  JP: 'Japan', SG: 'Singapore', TH: 'Thailand', US: 'USA', HK: 'Hong Kong', KR: 'Korea', DE: 'Germany',
  GB: 'UK', IN: 'India', ID: 'Indonesia', MY: 'Malaysia', VN: 'Vietnam', TW: 'Taiwan', AU: 'Australia',
  NL: 'Netherlands', FR: 'France',
};

/** In stock / Out of stock switch per VPN country. */
export function VpnStockPanel({
  rows,
  action,
}: {
  rows: Row[];
  action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(country: string, next: boolean) {
    setBusy(country);
    setErr(null);
    const fd = new FormData();
    fd.set('country', country);
    fd.set('inStock', String(next));
    try {
      const res = await action(fd);
      if (!res.ok) setErr(res.error || 'Could not update.');
    } catch {
      setErr('Could not update — try again.');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No VPN countries yet.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const reason = !r.manualInStock ? 'Turned off by you' : !r.hasServer ? 'No working server for new sales' : 'Selling';
        return (
          <div
            key={r.country}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-xl">{FLAGS[r.country] ?? '🌐'}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{NAMES[r.country] ?? r.country}</p>
                <p className={`text-[11px] ${r.inStock ? 'text-emerald-400' : r.manualInStock ? 'text-amber-300' : 'text-slate-500'}`}>
                  {r.inStock ? '● In stock' : '● Out of stock'} · {reason}
                </p>
              </div>
            </div>

            {/* Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={r.manualInStock}
              disabled={busy === r.country}
              onClick={() => toggle(r.country, !r.manualInStock)}
              className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                r.manualInStock ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
              title={r.manualInStock ? 'Click to set Out of stock' : 'Click to set In stock'}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  r.manualInStock ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        );
      })}
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <p className="text-[11px] text-slate-500">
        Switch ON = sell this country. It still shows Out of stock automatically if no server is On and taking new sales
        (or the server is down).
      </p>
    </div>
  );
}
