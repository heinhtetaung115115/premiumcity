import { getWalletOverview, listTopupRequests } from '@/lib/wallet';
import { requireAuth } from '@/lib/session';
import { formatCurrency } from '@/utils/currency';
import { Card, InlineLink } from '@/components/ui';

export default async function WalletPage({ searchParams }: { searchParams: { topup?: string } }) {
  const session = await requireAuth();
  const [wallet, topups] = await Promise.all([
    getWalletOverview(session.user.id!),
    listTopupRequests(session.user.id!)
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Wallet balance</h1>
          <p className="text-sm text-slate-400">Use your wallet for instant checkout across all products.</p>
        </div>
        <InlineLink href="/topup">Top up balance</InlineLink>
      </header>
      {searchParams.topup === 'submitted' && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          Top up submitted. We will notify you by email once it is approved.
        </div>
      )}
      <Card>
        <div className="text-4xl font-semibold text-emerald-300">{wallet ? formatCurrency(Number(wallet.walletBalance)) : '—'}</div>
        <p className="mt-2 text-sm text-slate-400">Last 25 transactions</p>
        <ul className="mt-4 space-y-2 text-sm">
          {wallet && wallet.walletTransactions.length > 0 ? (
            wallet.walletTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between">
                <span className="text-slate-300">{tx.type}</span>
                <span className={Number(tx.amount) > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {Number(tx.amount) > 0 ? '+' : ''}
                  {formatCurrency(Number(tx.amount))}
                </span>
              </li>
            ))
          ) : (
            <li>No transactions yet.</li>
          )}
        </ul>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Top up history</h2>
        <div className="space-y-2 text-sm">
          {topups.map((topup) => (
            <div key={topup.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-3 py-2">
              <div>
                <p className="font-medium text-slate-200">{formatCurrency(Number(topup.amount))}</p>
                <p className="text-xs text-slate-500">{topup.bankName}</p>
              </div>
              <div className="text-xs uppercase text-slate-400">{topup.status}</div>
            </div>
          ))}
          {topups.length === 0 && <p className="text-slate-400">No top ups yet.</p>}
        </div>
      </section>
    </div>
  );
}
