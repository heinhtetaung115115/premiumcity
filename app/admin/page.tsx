// app/admin/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listPendingManualDeliveries, getAdminSalesStats } from '@/lib/orders';
import { listPendingTopupsForAdmin } from '@/lib/wallet';
import { processTopup } from './topups/actions';
import { dismissManualDeliveryAction } from './orders/actions';
import { SalesStatsHero } from './SalesStatsHero';

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

  const [pendingDeliveries, pendingTopups, salesStats] = await Promise.all([
    listPendingManualDeliveries(200),
    listPendingTopupsForAdmin(200),
    getAdminSalesStats(),
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
          <div className="space-y-2">
            {deliveriesToShow.map((d) => (
              <Card key={d.orderItemId} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {d.productName}
                      {d.variantName ? ` · ${d.variantName}` : ''}{' '}
                      <span className="text-xs text-slate-500">x{d.quantity}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.userEmail ?? 'Unknown customer'} · {timeAgo(d.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/orders?orderId=${d.orderId}`}
                      className="inline-flex items-center justify-center rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                    >
                      Go deliver
                    </Link>
                    <form action={dismissDeliveryFormAction}>
                      <input type="hidden" name="orderItemId" value={d.orderItemId} />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-400 hover:text-rose-300"
                        title="Mark as delivered (already handled via Telegram)"
                      >
                        Mark done
                      </button>
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
          <div className="space-y-2">
            {topupsToShow.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {Number(t.amount).toLocaleString('en-US')} MMK
                      <span className="ml-2 text-xs text-slate-500">
                        {t.bankName ?? t.method.toUpperCase()} · last 4 {t.last4}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.userEmail ?? t.userId} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveTopupFormAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="action" value="APPROVE" />
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        Approve
                      </Button>
                    </form>
                    <form action={rejectTopupFormAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="action" value="REJECT" />
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        Reject
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Secondary nav */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/products">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">Products &amp; Catalog</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage categories, products, pricing, and inventory credentials.
            </p>
          </Card>
        </Link>

        <Link href="/admin/orders">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">Orders</h2>
            <p className="mt-1 text-sm text-slate-400">
              View all orders, deliver manual products, and see credential history.
            </p>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">Users</h2>
            <p className="mt-1 text-sm text-slate-400">
              Search users by email and review their orders.
            </p>
          </Card>
        </Link>
      </section>
    </main>
  );
}
