'use client';

import { useState } from 'react';

type Period = 'today' | 'week' | 'month';
type Stat = { amount: number; count: number };
type Props = {
  today: Stat;
  week: Stat;
  month: Stat;
};

function formatKs(n: number) {
  return n.toLocaleString('en-US');
}

export function SalesStatsHero({ today, week, month }: Props) {
  const [period, setPeriod] = useState<Period>('today');

  const data: Record<Period, { stat: Stat; label: string }> = {
    today: { stat: today, label: 'Total sales today' },
    week: { stat: week, label: 'Total sales this week' },
    month: { stat: month, label: 'Total sales this month' },
  };

  const active = data[period];

  const tab = (p: Period, text: string) => (
    <button
      onClick={() => setPeriod(p)}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
        period === p ? 'bg-white/25 text-white' : 'text-emerald-50/80 hover:text-white'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
      <div className="relative">
        <div className="mb-3 flex gap-1">
          {tab('today', 'Today')}
          {tab('week', 'Week')}
          {tab('month', 'Month')}
        </div>
        <p className="text-xs text-emerald-50/90">{active.label}</p>
        <p className="text-3xl font-bold text-white">
          {formatKs(active.stat.amount)} <span className="text-base font-semibold">Ks</span>
        </p>
        <p className="mt-1 text-[11px] text-emerald-100/80">
          from {active.stat.count} completed order{active.stat.count === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
