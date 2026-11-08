import Link from 'next/link';
import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { countLiveLinksByAccount, listAccounts } from '@/lib/panel/data';
import { SERVICES, serviceInfo } from '@/lib/panel/rules';
import { createAccountAction, deleteAccountAction, markExpiryDoneAction } from './actions';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { dueExpiryJobs } from '@/lib/panel/expiry';
import { Shell, btnCls, cardCls, inputCls, labelCls } from './Shell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Yangon' });
}

export default async function PanelAdminHome({ searchParams }: { searchParams?: { q?: string; ok?: string } }) {
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

  // ── Dashboard numbers ──
  const DAY = 86_400_000;
  let dash: {
    accounts: number;
    used: number;
    total: number;
    activeCustomers: number;
    soon: { id: string; profile: string; customer: string; account: string; days: number }[];
    jobs: Awaited<ReturnType<typeof dueExpiryJobs>>;
    mailsToday: number;
    shownToday: number;
  } | null = null;
  if (!setupError && !q) {
    try {
      const active = accounts.filter((a) => a.status === 'active');
      const used = active.reduce((n, a) => n + Math.min(live[a.id] ?? 0, a.max_profiles ?? 5), 0);
      const total = active.reduce((n, a) => n + (a.max_profiles ?? 5), 0);
      const db = getServiceSupabaseClient();
      const { data: links } = await db
        .from('panel_links')
        .select('id,account_id,customer_name,profile_name,warranty_until,status')
        .eq('status', 'active')
        .limit(3000);
      const accEmail: Record<string, string> = Object.fromEntries(accounts.map((a) => [a.id, a.email]));
      const now = Date.now();
      const liveLinks = ((links ?? []) as any[]).filter((l) => new Date(l.warranty_until).getTime() > now);
      const soon = liveLinks
        .map((l) => ({
          id: l.id,
          profile: l.profile_name || 'Profile',
          customer: l.customer_name || 'Customer',
          account: accEmail[l.account_id] || '?',
          days: Math.ceil((new Date(l.warranty_until).getTime() - now) / DAY),
        }))
        .filter((x) => x.days <= 3)
        .sort((a, b) => a.days - b.days);
      const { data: mails } = await db.from('panel_emails').select('verdict,received_at').order('received_at', { ascending: false }).limit(500);
      const dayStart = new Date(new Date(now + 6.5 * 3600_000).toISOString().slice(0, 10) + 'T00:00:00+06:30').getTime();
      const today = ((mails ?? []) as any[]).filter((m) => new Date(m.received_at).getTime() >= dayStart);
      let jobs: Awaited<ReturnType<typeof dueExpiryJobs>> = [];
      try {
        jobs = await dueExpiryJobs();
      } catch {
        jobs = [];
      }
      dash = {
        accounts: active.length,
        used,
        total,
        activeCustomers: liveLinks.length,
        soon,
        jobs,
        mailsToday: today.length,
        shownToday: today.filter((m) => m.verdict === 'allowed').length,
      };
    } catch (e) {
      console.error('[panel dashboard]', e);
    }
  }

  return (
    <Shell base={base} active="accounts">
      {setupError && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          Database not ready ({setupError}). Run supabase/migrations/0005_account_panel.sql in Supabase.
        </p>
      )}

      {searchParams?.ok === 'deleted' && (
        <p className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">Account deleted.</p>
      )}
      {searchParams?.ok === 'jobdone' && (
        <p className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">Marked as done.</p>
      )}

      {dash && (
        <section className="mb-8 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Accounts', value: String(dash.accounts), sub: 'active' },
              {
                label: 'Profiles used',
                value: `${dash.used}/${dash.total}`,
                sub: `${Math.max(0, dash.total - dash.used)} free`,
                bar: dash.total ? dash.used / dash.total : 0,
              },
              { label: 'Customers', value: String(dash.activeCustomers), sub: 'with access' },
              { label: 'Emails today', value: String(dash.mailsToday), sub: `${dash.shownToday} shown to customers` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{c.value}</p>
                <p className="text-[11px] text-slate-500">{c.sub}</p>
                {'bar' in c && c.bar !== undefined && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${c.bar >= 0.9 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                      style={{ width: `${Math.round(c.bar * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-4">
              <p className="mb-2 text-sm font-semibold text-rose-200">⏰ Expired today — needs action ({dash.jobs.length})</p>
              {dash.jobs.length === 0 && <p className="text-xs text-slate-500">Nothing to do.</p>}
              <div className="space-y-1.5">
                {dash.jobs.slice(0, 12).map((j) => (
                  <div key={j.id} className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-100">
                        <b>{j.profile_name || 'Profile'}</b> · {j.customer_name || 'customer'}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{j.accountEmail}</p>
                    </div>
                    <form action={markExpiryDoneAction}>
                      <input type="hidden" name="linkId" value={j.id} />
                      <button className="rounded-lg border border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/10">
                        Job done
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-4">
              <p className="mb-2 text-sm font-semibold text-amber-200">⌛ Expiring in 3 days ({dash.soon.length})</p>
              {dash.soon.length === 0 && <p className="text-xs text-slate-500">No one.</p>}
              <div className="space-y-1.5">
                {dash.soon.slice(0, 12).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate text-slate-100">
                        <b>{x.profile}</b> · {x.customer}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{x.account}</p>
                    </div>
                    <span className="flex-shrink-0 font-semibold text-amber-300">{x.days}d</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
            <div key={a.id} className="flex items-stretch gap-2">
            <Link
              href={`${base}/admin/a/${a.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-indigo-400/50"
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
                <p className={(live[a.id] ?? 0) >= (a.max_profiles ?? 5) ? 'font-semibold text-amber-300' : 'text-slate-300'}>
                  👥 {live[a.id] ?? 0}/{a.max_profiles ?? 5} profiles
                </p>
                <p className={exp != null && exp <= 3 ? 'font-semibold text-amber-300' : 'text-slate-500'}>
                  {a.account_expires_at ? `Account ends ${fmt(a.account_expires_at)}` : 'No end date'}
                </p>
              </div>
            </Link>
            <details className="relative">
              <summary
                className="flex h-full cursor-pointer list-none items-center rounded-2xl border border-white/10 px-3 text-slate-500 hover:border-rose-400/50 hover:text-rose-300"
                title="Delete account"
              >
                🗑
              </summary>
              <form
                action={deleteAccountAction}
                className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-rose-500/30 bg-[#140c10] p-3 shadow-xl"
              >
                <input type="hidden" name="id" value={a.id} />
                <p className="mb-2 text-xs text-rose-200">
                  Delete <b>{a.email}</b> and all its customer links ({live[a.id] ?? 0} active)? Customers lose access. Tip: open the
                  account and use “Move customers” first if it was blocked.
                </p>
                <label className="mb-2 flex items-center gap-2 text-xs text-rose-100">
                  <input type="checkbox" name="confirm" required /> I understand
                </label>
                <button className="w-full rounded-lg bg-rose-500 py-1.5 text-xs font-bold text-white">Delete account</button>
              </form>
            </details>
            </div>
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
            <span className={labelCls}>Profiles on this account</span>
            <input name="maxProfiles" type="number" min={1} max={20} defaultValue={5} className={inputCls} />
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
