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
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Status drives the row icon, so state is readable at a glance. */
function statusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === 'APPROVED' || s === 'CREDITED') {
    return { tone: 'text-emerald-400', bg: 'bg-emerald-500/15', ok: true, pending: false };
  }
  if (s === 'PENDING') {
    return { tone: 'text-amber-400', bg: 'bg-amber-500/15', ok: false, pending: true };
  }
  return { tone: 'text-rose-400', bg: 'bg-rose-500/15', ok: false, pending: false };
}

function CoinIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5h-4a1.5 1.5 0 000 3h3a1.5 1.5 0 010 3h-4M12 7v10" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Wallet</h1>
        <p className="mt-1 text-sm text-slate-400">Your balance and activity.</p>
      </div>

      {/* Balance */}
      <div className="rounded-2xl bg-emerald-600 p-5">
        <p className="text-[11px] uppercase tracking-wide text-emerald-50/80">Current balance</p>
        <p className="mt-1 text-3xl font-bold text-white">
          {balance.toLocaleString('en-US')} <span className="text-base font-semibold">Ks</span>
        </p>
        <Link
          href="/topup"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Top up
        </Link>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-slate-900/70 p-3.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Topped up</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {totalToppedUp.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-3.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Spent</p>
          <p className="mt-1 text-lg font-bold text-rose-400">
            {totalSpent.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      {/* Segmented toggle */}
      <div className="flex rounded-xl bg-slate-900/70 p-1">
        <button
          type="button"
          onClick={() => setTab('topups')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            tab === 'topups' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Top-ups
        </button>
        <button
          type="button"
          onClick={() => setTab('spending')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            tab === 'spending' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Spending
        </button>
      </div>

      {/* List */}
      {tab === 'topups' ? (
        topups.length === 0 ? (
          <p className="rounded-xl bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-500">
            No top-ups yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {topups.map((t) => {
              const st = statusStyle(t.status);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-900/70 px-3 py-3"
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${st.bg} ${st.tone}`}
                  >
                    {st.ok ? <CoinIcon /> : st.pending ? <ClockIcon /> : <CrossIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-100">
                      {t.source === 'CRYPTO' ? 'Crypto top-up' : 'Bank top-up'}
                    </p>
                    <p className={`mt-0.5 truncate text-[10px] ${st.pending ? st.tone : 'text-slate-500'}`}>
                      {st.pending ? 'Pending · ' : ''}
                      {formatDate(t.createdAt)}
                      {t.detail ? ` · ${t.detail}` : ''}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[13px] font-semibold ${
                      st.ok ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {st.ok ? '+' : ''}
                    {t.amount.toLocaleString('en-US')}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : spending.length === 0 ? (
        <p className="rounded-xl bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-500">
          No spending yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {spending.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-900/70 px-3 py-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                <CartIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-100">
                  {s.description || 'Purchase'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">{formatDate(s.createdAt)}</p>
              </div>
              <span className="flex-shrink-0 text-[13px] font-semibold text-rose-400">
                -{s.amount.toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
