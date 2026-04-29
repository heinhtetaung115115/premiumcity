import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { processTopup } from './actions';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type TopupRow = {
  id: string;
  user_id: string;
  bank_account_id: string;
  amount: number;
  last4: string;
  method: 'qr' | 'account';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
};

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
};

export default async function AdminTopupsPage() {
  await requireAdmin();

  const supabase = getServiceSupabaseClient();

  // Fetch topups (newest first)
  const [topupsRes, banksRes] = await Promise.all([
    supabase
      .from('topups')
      .select(
        'id,user_id,bank_account_id,amount,last4,method,status,created_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('bank_accounts')
      .select('id,bank_name,account_name,account_no'),
  ]);

  if (topupsRes.error) throw topupsRes.error;
  if (banksRes.error) throw banksRes.error;

  const allTopups = (topupsRes.data as TopupRow[]) ?? [];
  // ✅ Show only PENDING by default
  const topups = allTopups.filter((t) => t.status === 'PENDING');

  const banks = (banksRes.data as BankRow[]) ?? [];
  const bankMap = new Map(banks.map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Top-up submissions</h1>
        <p className="text-sm text-slate-400">
          Review customer payment submissions and approve or reject them.
        </p>
      </header>

      {topups.length === 0 && <Card>No pending submissions.</Card>}

      <div className="space-y-4">
        {topups.map((t) => {
          const bank = bankMap.get(t.bank_account_id);
          const when = new Date(t.created_at).toLocaleString();
          const badge =
            t.status === 'PENDING'
              ? 'text-amber-300 border-amber-600'
              : t.status === 'APPROVED'
              ? 'text-emerald-300 border-emerald-600'
              : 'text-rose-300 border-rose-600';

          return (
            <Card key={t.id}>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase text-slate-500">User</p>
                  <p className="text-sm">{t.user_id}</p>
                  <p className="text-xs text-slate-500">{when}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase text-slate-500">Payment</p>
                  <p className="text-sm">
                    {bank
                      ? `${bank.bank_name} · ${bank.account_no}`
                      : 'Unknown bank'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Method: {t.method.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-400">
                    Last 4: {t.last4}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-slate-500">Amount</p>
                  <p className="text-lg font-semibold text-emerald-300">
                    {Number(t.amount).toFixed(0)}
                  </p>
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-xs ${badge}`}
                  >
                    {t.status}
                  </span>

                  {t.status === 'PENDING' && (
                    <div className="mt-2 flex gap-2">
                      {/* APPROVE */}
                      <form
                        action={async (formData: FormData) => {
                          'use server';
                          await processTopup(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="hidden"
                          name="action"
                          value="APPROVE"
                        />
                        <Button type="submit" variant="secondary">
                          Approve
                        </Button>
                      </form>

                      {/* REJECT */}
                      <form
                        action={async (formData: FormData) => {
                          'use server';
                          await processTopup(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="hidden"
                          name="action"
                          value="REJECT"
                        />
                        <Button type="submit" variant="secondary">
                          Reject
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
