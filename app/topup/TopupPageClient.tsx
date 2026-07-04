// app/topup/TopupPageClient.tsx
'use client';

import { useState } from 'react';
import KbzTopupForm from './KbzTopupForm';
import ManualTopupForm from './ManualTopupForm';

type BankRow = { id: string; bank_name: string; account_name: string; account_no: string; qr_code_url: string | null; instructions: string | null };
type Props = { banks: BankRow[]; reason?: string; balance?: number };

export default function TopupPageClient({ banks, reason, balance = 0 }: Props) {
  const [selected, setSelected] = useState<null | 'kbz' | 'manual'>(null);
  const kbzBank = banks.find((b) => b.bank_name.toLowerCase().includes('kbz'));
  const manualBanks = banks.filter((b) => !b.bank_name.toLowerCase().includes('kbz'));

  return (
    <div className={`mx-auto space-y-5 ${selected === null ? 'max-w-md' : 'max-w-4xl'}`}>
      {reason === 'insufficient_balance' && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-50">
          <p className="font-semibold">Not enough wallet balance</p>
          <p className="mt-1 text-amber-100/90">Please top up your wallet and then try buying the product again.</p>
        </div>
      )}

      {/* ── Balance card (only on chooser) ── */}
      {selected === null && (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
          <p className="text-[13px] text-emerald-50/90">Current balance</p>
          <p className="text-3xl font-semibold text-white">
            {balance.toLocaleString()} <span className="text-base">KS</span>
          </p>
        </div>
      )}

      {selected === null && (
        <>
          <p className="text-sm font-semibold text-slate-100">Choose payment method</p>
          <div className="flex flex-col gap-3">
            {kbzBank && (
              <button
                onClick={() => setSelected('kbz')}
                className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 text-left transition hover:border-emerald-500/60 hover:bg-emerald-500/[0.12]"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">KBZ Pay</p>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">AUTO</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">Instant verification under 50,000 KS</p>
                </div>
                <svg className="h-5 w-5 flex-shrink-0 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {manualBanks.length > 0 && (
              <button
                onClick={() => setSelected('manual')}
                className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-white/[0.03] p-4 text-left transition hover:border-slate-700 hover:bg-white/[0.05]"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-500/10">
                  <svg className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">
                      {manualBanks.map((b) => b.bank_name).join(' / ')}
                    </p>
                    <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">MANUAL</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">Transfer &amp; submit — we verify</p>
                </div>
                <svg className="h-5 w-5 flex-shrink-0 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      {selected === 'kbz' && kbzBank && (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-300">← Back to payment methods</button>
          <KbzTopupForm bank={kbzBank} />
        </div>
      )}

      {selected === 'manual' && (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-300">← Back to payment methods</button>
          <ManualTopupForm banks={manualBanks} />
        </div>
      )}
    </div>
  );
}
