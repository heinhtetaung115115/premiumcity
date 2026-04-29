import { requireAuth } from '@/lib/session';
import { getWalletOverview, listTopupRequests } from '@/lib/wallet';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function WalletPage() {
  const session = await requireAuth();
  const [wallet, topups] = await Promise.all([
    getWalletOverview(session.user.id!),
    listTopupRequests(session.user.id!)
  ]);

  const balanceRaw = wallet?.balance;
  const balance =
    typeof balanceRaw === 'number' && Number.isFinite(balanceRaw)
      ? balanceRaw
      : 0;

  const txs = wallet?.walletTransactions ?? [];
  const topupList = topups ?? [];

  // Normalize wallet transactions into history items
  const txHistory = txs.map((tx: any) => {
    const isIn = tx.direction === 'IN';

    // Keep description, but make it nicer if missing
    const title =
      tx.description ||
      (isIn ? 'Wallet credit' : 'Wallet debit');

    return {
      id: `tx_${tx.id}`,
      createdAt: tx.createdAt,
      title,
      line2: formatDate(tx.createdAt),
      amount: Number(tx.amount) || 0,
      sign: isIn ? '+' : '-',
      colorClass: isIn ? 'text-emerald-400' : 'text-rose-400',
      kind: 'transaction' as const
    };
  });

  // Normalize topups into history items
  // IMPORTANT: exclude APPROVED topups to avoid double entries
  const topupHistory = topupList
    .filter((t: any) => t.status !== 'APPROVED')
    .map((t: any) => {
      let sign: '+' | '-' | '' = '';
      let colorClass = 'text-slate-300';
      let title = 'Wallet top-up';

      if (t.status === 'PENDING') {
        title = 'Top-up pending';
        sign = ''; // not credited yet
        colorClass = 'text-amber-300';
      } else if (t.status === 'REJECTED') {
        title = 'Top-up rejected';
        sign = '';
        colorClass = 'text-rose-400';
      }

      return {
        id: `topup_${t.id}`,
        createdAt: t.createdAt,
        title,
        line2: `${formatDate(t.createdAt)} · ${t.status.toLowerCase()} · ${t.method.toUpperCase()} · last 4 ${t.last4}`,
        amount: Number(t.amount) || 0,
        sign,
        colorClass,
        kind: 'topup' as const
      };
    });

  // Merge and sort newest first
  const history = [...txHistory, ...topupHistory].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-8">
      {/* MAIN BALANCE */}
      <section>
        <h1 className="text-2xl font-semibold text-slate-100">Wallet</h1>
        <p className="mt-1 text-sm text-slate-400">
          This is your PremiumCity wallet balance in MMK.
        </p>

        <Card>
          <div className="mt-4 flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-xs uppercase text-slate-500">
                Current balance
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-400">
                {balance.toLocaleString('en-US')} MMK
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* HISTORY */}
      <section>
        <details className="group rounded-2xl border border-slate-800 bg-slate-900/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-slate-100">
              History
            </span>
            <span className="text-xs text-slate-400 group-open:hidden">
              Click to view history
            </span>
            <span className="hidden text-xs text-slate-400 group-open:inline">
              Click to hide history
            </span>
          </summary>

          <div className="border-t border-slate-800 px-4 py-4">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="group rounded-2xl bg-gradient-to-r from-slate-800/80 via-slate-900/80 to-slate-800/80 p-[1px] transition-shadow hover:shadow-[0_0_18px_rgba(15,23,42,0.9)]"
                  >
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-3 py-2.5 md:px-4 md:py-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-slate-100">
                            {item.title}
                          </span>

                          {/* Subtle pill for top-ups */}
                          {item.kind === 'topup' && (
                            <span className="rounded-full bg-slate-900 px-2 py-[2px] text-[10px] uppercase tracking-wide text-slate-400">
                              Top-up
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 text-[11px] text-slate-500">
                          {item.line2}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-semibold ${item.colorClass}`}
                        >
                          {item.sign}
                          {item.amount.toLocaleString('en-US')} MMK
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
