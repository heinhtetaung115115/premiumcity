import Link from 'next/link';
import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { countLiveLinksByAccount, listAccounts } from '@/lib/panel/data';
import { SERVICES, serviceInfo } from '@/lib/panel/rules';
import { createAccountAction } from './actions';
import { Shell, btnCls, cardCls, inputCls, labelCls } from './Shell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Yangon' });
}

export default async function PanelAdminHome({ searchParams }: { searchParams?: { q?: string } }) {
  requirePanelAdmin();
  const base = panelBase();
  const q = searchParams?.q ?? '';

  let accounts: Awaited<ReturnType<typeof listAccounts>> = [];
  let setupError: string | null = null;
  try {
    accounts = await listAccounts(q);
  } catch (e: any) {
    setupError = e?.message ?? String(e);
  }
  const live = setupError ? {} : await countLiveLinksByAccount();

  return (
    <Shell base={base} active="accounts">
      {setupError && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          Database not ready ({setupError}). Run supabase/migrations/0005_account_panel.sql in Supabase.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Accounts</h1>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search email / supplier / notes" className={`${inputCls} w-64`} />
          <button className="rounded-xl border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/5">Search</button>
        </form>
      </div>

      <div className="mb-6 space-y-2">
        {accounts.length === 0 && !setupError && <p className="text-sm text-slate-500">No accounts yet — add one below.</p>}
        {accounts.map((a) => {
          const svc = serviceInfo(a.service);
          const exp = a.account_expires_at ? Math.ceil((new Date(a.account_expires_at).getTime() - Date.now()) / 86_400_000) : null;
          return (
            <Link
              key={a.id}
              href={`${base}/admin/a/${a.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-indigo-400/50"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black text-white" style={{ background: svc.color === '#ffffff' ? '#334155' : svc.color }}>
                {svc.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{a.email}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {svc.name}
                  {a.supplier ? ` · ${a.supplier}` : ''}
                  {a.status !== 'active' ? ' · archived' : ''}
                </p>
              </div>
              <div className="text-right text-[11px]">
                <p className="text-slate-300">👥 {live[a.id] ?? 0} live link{(live[a.id] ?? 0) === 1 ? '' : 's'}</p>
                <p className={exp != null && exp <= 3 ? 'font-semibold text-amber-300' : 'text-slate-500'}>
                  {a.account_expires_at ? `Account ends ${fmt(a.account_expires_at)}` : 'No end date'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <details className={cardCls} open={accounts.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-indigo-300">+ Add account</summary>
        <form action={createAccountAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Service</span>
            <select name="service" defaultValue="crunchyroll" className={inputCls}>
              {Object.entries(SERVICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Account email</span>
            <input name="email" type="email" required className={inputCls} placeholder="name@gmail.com" />
          </label>
          <label>
            <span className={labelCls}>Password</span>
            <input name="password" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Account ends (optional)</span>
            <input name="accountExpires" type="date" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Profile (optional)</span>
            <input name="profile" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>PIN (optional)</span>
            <input name="pin" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Supplier (optional)</span>
            <input name="supplier" className={inputCls} placeholder="e.g. Plati seller name" />
          </label>
          <label>
            <span className={labelCls}>Notes (admin only)</span>
            <input name="notes" className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button className={btnCls}>Add account</button>
          </div>
        </form>
      </details>
    </Shell>
  );
}
