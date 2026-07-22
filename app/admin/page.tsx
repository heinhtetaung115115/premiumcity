// app/admin/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { listPendingManualDeliveries, getAdminSalesStats } from '@/lib/orders';
import { getOutOfStockVariants } from '@/lib/catalog';
import { OutOfStockPanel } from './OutOfStockPanel';
import { listPendingTopupsForAdmin } from '@/lib/wallet';
import { processTopup } from './topups/actions';
import { dismissManualDeliveryAction } from './orders/actions';
import { SalesStatsHero } from './SalesStatsHero';
import { SubmitButton } from '@/components/admin/SubmitButton';

export const dynamic = 'force-dynamic';

function timeAgo(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function approveTopupFormAction(formData: FormData): Promise<void> {
  'use server';
  await processTopup(formData);
}

async function rejectTopupFormAction(formData: FormData): Promise<void> {
  'use server';
  await processTopup(formData);
}

async function dismissDeliveryFormAction(formData: FormData): Promise<void> {
  'use server';
  await dismissManualDeliveryAction(formData);
  redirect('/admin');
}

export default async function AdminHomePage() {
  await requireAdmin();

  const [pendingDeliveries, pendingTopups, salesStats, outOfStock] = await Promise.all([
    listPendingManualDeliveries(200),
    listPendingTopupsForAdmin(200),
    getAdminSalesStats(),
    getOutOfStockVariants(),
  ]);

  const deliveriesCount = pendingDeliveries.length;
  const topupsCount = pendingTopups.length;

  // Only show the first 8 in the lists below (counts use the full length above)
  const deliveriesToShow = pendingDeliveries.slice(0, 8);
  const topupsToShow = pendingTopups.slice(0, 8);

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">Admin dashboard</h1>
        <p className="text-sm text-slate-400">
          What needs your attention right now.
        </p>
      </header>

      {/* ── STATS: hero revenue + action counts ── */}
      <section className="space-y-3">
        <SalesStatsHero
          today={salesStats.today}
          week={salesStats.week}
          month={salesStats.month}
        />
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="#deliveries"
            className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 transition hover:border-amber-500/50"
          >
            <div>
              <p className="text-2xl font-bold leading-none text-amber-300">{deliveriesCount}</p>
              <p className="mt-1.5 text-[11px] text-slate-400">Deliveries pending</p>
            </div>
            <svg className="h-7 w-7 text-amber-500/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
            </svg>
          </Link>
          <Link
            href="#topups"
            className="flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] p-4 transition hover:border-sky-500/50"
          >
            <div>
              <p className="text-2xl font-bold leading-none text-sky-300">{topupsCount}</p>
              <p className="mt-1.5 text-[11px] text-slate-400">Top-ups to review</p>
            </div>
            <svg className="h-7 w-7 text-sky-500/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Pending manual deliveries */}
      <section id="deliveries" className="scroll-mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Manual orders needing delivery
            <span className="ml-2 rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-300">
              {deliveriesCount}
            </span>
          </h2>
          <Link href="/admin/orders" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all orders
          </Link>
        </div>

        {deliveriesToShow.length === 0 ? (
          <Card className="p-4 text-sm text-slate-400">Nothing waiting — all manual orders are delivered.</Card>
        ) : (
          <div className="space-y-2.5">
            {deliveriesToShow.map((d) => (
              <Card key={d.orderItemId} className="overflow-hidden border-[#26344e] bg-[#151e30] p-0">
                <div className="h-[3px] bg-amber-500" />
                <div className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                          <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {d.productName}
                          {d.variantName ? ` · ${d.variantName}` : ''}{' '}
                          <span className="font-normal text-slate-500">×{d.quantity}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {d.userEmail ?? 'Unknown customer'} · {timeAgo(d.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 rounded bg-amber-500/20 px-2 py-1 text-[8px] font-bold text-amber-300">
                      PENDING
                    </span>
                  </div>
                  <div className="flex gap-2 sm:justify-start">
                    <Link
                      href={`/admin/orders?orderId=${d.orderId}`}
                      className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 sm:flex-none"
                    >
                      Go deliver →
                    </Link>
                    <form action={dismissDeliveryFormAction} className="sm:flex-none">
                      <input type="hidden" name="orderItemId" value={d.orderItemId} />
                      <SubmitButton variant="neutral">Mark done</SubmitButton>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pending top-ups */}
      <section id="topups" className="scroll-mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Top-ups needing review
            <span className="ml-2 rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-300">
              {topupsCount}
            </span>
          </h2>
          <Link href="/admin/topups" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all top-ups
          </Link>
        </div>

        {topupsToShow.length === 0 ? (
          <Card className="p-4 text-sm text-slate-400">No pending top-ups.</Card>
        ) : (
          <div className="space-y-2.5">
            {topupsToShow.map((t) => (
              <Card key={t.id} className="overflow-hidden border-[#26344e] bg-[#151e30] p-0">
                <div className="h-[3px] bg-sky-500" />
                <div className="p-4">
                  <div className="mb-3 flex gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20M6 15h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-slate-50">
                        {Number(t.amount).toLocaleString('en-US')}{' '}
                        <span className="text-[11px] font-medium text-slate-400">MMK</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {t.bankName ?? t.method.toUpperCase()} · last 4{' '}
                        <span className="font-mono text-slate-300">{t.last4}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {t.userEmail ?? t.userId} · {timeAgo(t.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:justify-start">
                    <form action={approveTopupFormAction} className="flex-1 sm:flex-none">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="action" value="APPROVE" />
                      <SubmitButton variant="approve" fullWidth className="sm:w-auto sm:px-6">
                        ✓ Approve
                      </SubmitButton>
                    </form>
                    <form action={rejectTopupFormAction} className="flex-1 sm:flex-none">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="action" value="REJECT" />
                      <SubmitButton variant="reject" fullWidth className="sm:w-auto sm:px-6">
                        ✕ Reject
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── OUT OF STOCK: collapsible, shows count until expanded ── */}
      <OutOfStockPanel items={outOfStock} />

      {/* Secondary nav */}
      <section className="grid grid-cols-2 gap-3">
        <Link href="/admin/products">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Products &amp; Catalog</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">Categories, pricing, inventory</p>
          </Card>
        </Link>

        <Link href="/admin/orders">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M9 2h6a2 2 0 012 2v16l-3-2-2 2-2-2-3 2V4a2 2 0 012-2z" />
                <path d="M9 7h6M9 11h6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Orders</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">All orders &amp; delivery history</p>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Users</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">Search &amp; review customers</p>
          </Card>
        </Link>

        <Link href="/admin/reports">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M3 3v18h18M8 17V9M13 17V5M18 17v-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Reports</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">Sales &amp; analytics</p>
          </Card>
        </Link>

        <Link href="/admin/crypto-rate">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Crypto rate</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">MMK/USDT feed &amp; override</p>
          </Card>
        </Link>

        <Link href="/admin/renewals">
          <Card className="h-full cursor-pointer border-[#26344e] bg-[#151e30] p-4 transition hover:border-emerald-400">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3M21 3v6h-6M3 21v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-100">Netflix renewals</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">Approve, reject &amp; links</p>
          </Card>
        </Link>
      </section>
    </main>
  );
}
