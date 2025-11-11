import { listPendingTopups } from '@/lib/wallet';
import { processTopup } from './actions';
import { Card, TextArea, Button } from '@/components/ui';
import { formatCurrency } from '@/utils/currency';

export default async function AdminTopupsPage() {
  const topups = await listPendingTopups();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Top up requests</h1>
        <p className="text-sm text-slate-400">Review customer wallet funding submissions.</p>
      </header>
      <div className="space-y-4">
        {topups.map((topup) => (
          <Card key={topup.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">{new Date(topup.createdAt).toLocaleString()}</p>
                <p className="text-lg font-medium text-slate-100">
                  {topup.user?.email ?? 'Unknown user'} — {formatCurrency(Number(topup.amount))}
                </p>
                <p className="text-sm text-slate-400">{topup.bankName} · ref {topup.referenceHint}</p>
                {topup.metadata && 'note' in topup.metadata && (
                  <p className="text-xs text-slate-500">Note: {(topup.metadata as { note?: string }).note}</p>
                )}
              </div>
              <div className="text-xs uppercase text-slate-400">{topup.status}</div>
            </div>
            {topup.status === 'PENDING' && (
              <form action={processTopup} className="mt-4 space-y-2">
                <input type="hidden" name="topupId" value={topup.id} />
                <TextArea name="comment" placeholder="Optional rejection note" rows={2} />
                <div className="flex gap-2">
                  <Button name="action" value="approve" type="submit">
                    Approve
                  </Button>
                  <Button name="action" value="reject" type="submit" variant="secondary">
                    Reject
                  </Button>
                </div>
              </form>
            )}
          </Card>
        ))}
        {topups.length === 0 && <Card>All caught up!</Card>}
      </div>
    </div>
  );
}
