// app/admin/reports/page.tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { getAdminReportStats } from '@/lib/orders';

export const dynamic = 'force-dynamic';

function ks(n: number) {
  return n.toLocaleString('en-US');
}

export default async function AdminReportsPage() {
  await requireAdmin();
  const stats = await getAdminReportStats();

  const maxDaily = Math.max(1, ...stats.dailyLast7.map((d) => d.amount));

  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="text-sm text-emerald-400 hover:text-emerald-300">← Back</Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400">Sales analytics · completed orders only</p>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Today', v: stats.today, tint: 'from-emerald-700 to-emerald-500 text-white' },
          { label: 'This week', v: stats.week, tint: 'bg-[#151e30] border border-[#26344e]' },
          { label: 'This month', v: stats.month, tint: 'bg-[#151e30] border border-[#26344e]' },
          { label: 'All time', v: stats.allTime, tint: 'bg-[#151e30] border border-[#26344e]' },
        ].map((c) => {
          const isHero = c.label === 'Today';
          return (
            <div
              key={c.label}
              className={`rounded-2xl p-4 ${isHero ? `bg-gradient-to-br ${c.tint}` : c.tint}`}
            >
              <p className={`text-[11px] ${isHero ? 'text-emerald-50/90' : 'text-slate-400'}`}>{c.label}</p>
              <p className={`mt-1 text-xl font-bold ${isHero ? 'text-white' : 'text-slate-50'}`}>
                {ks(c.v.amount)} <span className="text-xs font-medium">Ks</span>
              </p>
              <p className={`mt-0.5 text-[10px] ${isHero ? 'text-emerald-100/80' : 'text-slate-500'}`}>
                {c.v.count} order{c.v.count === 1 ? '' : 's'}
              </p>
            </div>
          );
        })}
      </section>

      {/* 7-day bar chart */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Last 7 days</h2>
        <Card className="border-[#26344e] bg-[#151e30] p-5">
          <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
            {stats.dailyLast7.map((d) => {
              const h = Math.round((d.amount / maxDaily) * 130);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-[34px] rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400"
                      style={{ height: Math.max(4, h) }}
                      title={`${ks(d.amount)} Ks · ${d.count} orders`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Top products this month */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Top products this month</h2>
        {stats.topProducts.length === 0 ? (
          <Card className="border-[#26344e] bg-[#151e30] p-4 text-sm text-slate-400">
            No sales yet this month.
          </Card>
        ) : (
          <Card className="overflow-hidden border-[#26344e] bg-[#151e30] p-0">
            {stats.topProducts.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center justify-between px-4 py-3 ${
                  i > 0 ? 'border-t border-[#26344e]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm text-slate-100">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.count} sold</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-50">{ks(p.amount)} Ks</p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}
