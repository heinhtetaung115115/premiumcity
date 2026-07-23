'use client';

import { useState } from 'react';
import Link from 'next/link';

type TopupEntry = {
  id: string;
  amount: number;
  status: string;
  source: 'MANUAL' | 'CRYPTO';
  detail: string | null;
  createdAt: string;
};

type SpendEntry = {
  id: string;
  amount: number;
  description: string | null;
  createdAt: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const style =
    s === 'APPROVED' || s === 'CREDITED'
      ? 'bg-emerald-500/15 text-emerald-300'
      : s === 'PENDING'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-rose-500/15 text-rose-300';
  const label =
    s === 'CREDITED' ? 'CREDITED' : s === 'APPROVED' ? 'APPROVED' : s === 'PENDING' ? 'PENDING' : s;
  return (
    <span className={`rounded-full px-2 py-[2px] text-[10px] font-semibold tracking-wide ${style}`}>
      {label}
    </span>
  );
}

export default function WalletClient({
  balance,
  topups,
  spending,
  totalToppedUp,
  totalSpent,
}: {
  balance: number;
  topups: TopupEntry[];
  spending: SpendEntry[];
  totalToppedUp: number;
  totalSpent: number;
}) {
  const [tab, setTab] = useState<'topups' | 'spending'>('topups');

  return (
    <div className="space-y-6">
      {/* Balance */}
      <section>
        <h1 className="text-2xl font-semibold text-slate-100">Wallet</h1>
        <p className="mt-1 text-sm text-slate-400">Your PremiumCity balance and activity.</p>

        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
          <p className="text-xs uppercase tracking-wide text-emerald-50/80">Current balance</p>
          <p className="mt-1 text-4xl font-bold text-white">
            {balance.toLocaleString('en-US')} <span className="text-xl">Ks</span>
          </p>
          <Link
            href="/topup"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Top up
          </Link>
        </div>

        {/* Totals */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Total topped up</p>
            <p className="mt-1 text-lg font-bold text-emerald-400">
              {totalToppedUp.toLocaleString('en-US')} Ks
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Total spent</p>
            <p className="mt-1 text-lg font-bold text-rose-400">
              {totalSpent.toLocaleString('en-US')} Ks
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('topups')}
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'topups'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
            }`}
          >
            Top-up history
          </button>
          <button
            type="button"
            onClick={() => setTab('spending')}
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'spending'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
            }`}
          >
            Spending
          </button>
        </div>

        <div className="mt-3">
          {tab === 'topups' ? (
            topups.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                No top-ups yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {topups.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-slate-100">
                          {t.source === 'CRYPTO' ? 'Crypto top-up' : 'Bank top-up'}
                        </span>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {formatDate(t.createdAt)}
                        {t.detail ? ` · ${t.detail}` : ''}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-sm font-semibold ${
                        t.status === 'APPROVED' || t.status === 'CREDITED'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {t.status === 'APPROVED' || t.status === 'CREDITED' ? '+' : ''}
                      {t.amount.toLocaleString('en-US')} Ks
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : spending.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
              No spending yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {spending.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-100">
                      {s.description || 'Purchase'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(s.createdAt)}</p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-rose-400">
                    -{s.amount.toLocaleString('en-US')} Ks
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
