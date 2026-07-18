// app/admin/renewals/page.tsx
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { approveRenewalAction, rejectRenewalAction, updateNetflixLinkAction } from './actions';

export const dynamic = 'force-dynamic';

type RenewalRow = {
  id: string;
  order_item_id: string;
  order_id: string;
  user_id: string;
  status: string;
  plan_name: string | null;
  amount: number | null;
  created_at: string;
  email?: string;
};

async function loadRenewals(): Promise<RenewalRow[]> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('netflix_renewals')
    .select('id,order_item_id,order_id,user_id,status,plan_name,amount,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = ((data ?? []) as any[]) as RenewalRow[];

  // Attach emails.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  if (userIds.length) {
    const { data: users } = await supabase.from('users').select('id,email').in('id', userIds);
    const byId = new Map(((users ?? []) as any[]).map((u) => [u.id, u.email]));
    for (const r of rows) r.email = byId.get(r.user_id) ?? undefined;
  }
  return rows;
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function RenewalsPage() {
  await requireAdmin();
  const rows = await loadRenewals();
  const pending = rows.filter((r) => r.status === 'PENDING');
  const resolved = rows.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Netflix renewals</h1>
        <p className="mt-1 text-sm text-slate-400">
          Extend with your supplier, then Approve (keep payment) or Reject (auto-refund). You can
          also replace a dead supplier link here.
        </p>
      </header>

      {/* Pending */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-amber-300">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No pending renewals.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {r.plan_name ?? 'Renewal'} ·{' '}
                      <span className="text-emerald-300">
                        {Number(r.amount ?? 0).toLocaleString()} Ks
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{r.email ?? r.user_id}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {ago(r.created_at)} · order {r.order_id.slice(0, 8)}…
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <form action={approveRenewalAction}>
                      <input type="hidden" name="renewalId" value={r.id} />
                      <button className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400">
                        Approve
                      </button>
                    </form>
                    <form action={rejectRenewalAction}>
                      <input type="hidden" name="renewalId" value={r.id} />
                      <button className="rounded-lg border border-rose-500/50 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">
                        Reject &amp; refund
                      </button>
                    </form>
                  </div>
                </div>

                {/* Replace supplier link */}
                <form
                  action={updateNetflixLinkAction}
                  className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3"
                >
                  <input type="hidden" name="orderItemId" value={r.order_item_id} />
                  <input
                    name="link"
                    placeholder="Replace supplier link (if extended/changed)…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <button className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300">
                    Update link
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Recent</h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-left font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-xs text-slate-300">{r.email ?? r.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">{r.plan_name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">
                      {Number(r.amount ?? 0).toLocaleString()} Ks
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          r.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
