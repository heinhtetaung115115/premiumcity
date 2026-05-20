// app/topup/TopupPageClient.tsx
'use client';

import { useState } from 'react';
import KbzTopupForm from './KbzTopupForm';
import ManualTopupForm from './ManualTopupForm';

type BankRow = { id: string; bank_name: string; account_name: string; account_no: string; qr_code_url: string | null; instructions: string | null };
type Props = { banks: BankRow[]; reason?: string };

export default function TopupPageClient({ banks, reason }: Props) {
  const [selected, setSelected] = useState<null | 'kbz' | 'manual'>(null);
  const kbzBank = banks.find((b) => b.bank_name.toLowerCase().includes('kbz'));
  const manualBanks = banks.filter((b) => !b.bank_name.toLowerCase().includes('kbz'));

  return (
    <div className="space-y-6">
      {reason === 'insufficient_balance' && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-50">
          <p className="font-semibold">Not enough wallet balance</p>
          <p className="mt-1 text-amber-100/90">Please top up your wallet and then try buying the product again.</p>
        </div>
      )}

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Top up wallet</h1>
        <p className="text-sm text-slate-400">Choose your payment method to get started.</p>
      </header>

      {selected === null && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kbzBank && (
            <button onClick={() => setSelected('kbz')}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-left transition hover:border-emerald-500/50 hover:bg-slate-900/80">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent transition-all duration-500 group-hover:via-emerald-400/60" />
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10"><span className="text-xl">💳</span></div>
                <div>
                  <p className="font-semibold text-slate-100">KBZ Pay</p>
                  <p className="text-[10px] text-emerald-400">⚡ Auto-approval</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Upload screenshot for instant verification. Under 50,000 KS approved automatically.</p>
            </button>
          )}
          {manualBanks.length > 0 && (
            <button onClick={() => setSelected('manual')}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900/80">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800"><span className="text-xl">🏦</span></div>
                <div>
                  <p className="font-semibold text-slate-100">{manualBanks.map((b) => b.bank_name).join(' / ')}</p>
                  <p className="text-[10px] text-slate-500">Manual review</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Transfer and submit your transaction details. We'll verify and credit your wallet.</p>
            </button>
          )}
        </div>
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
