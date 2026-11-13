import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { dynamicKeyFor, getVpnStock, isExpired, isWholePlanData, listServers, statusPageUrl, subscriptionLinkFor } from '@/lib/vpn';
import { VpnStockPanel } from './VpnStockPanel';
import {
  addServerAction,
  adminReplaceKeyAction,
  createManualKeyAction,
  extendAction,
  setExpiryDateAction,
  moveAllAction,
  revokeAction,
  setVpnStockAction,
  updateServerAction,
} from './actions';
import {
  AddServerForm,
  CopyButton,
  CreateManualKeyForm,
  ServerControls,
  SubscriptionActions,
} from './AdminVpnForms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Moving all customers to a new server can take a while.
export const maxDuration = 300;

type PageProps = { searchParams?: { q?: string; tab?: string } };

const DAY_MS = 86_400_000;

function fmtGb(b: number) {
  return `${(b / 1e9).toFixed(b >= 1e10 ? 0 : 1)} GB`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Yangon' });
}

export default async function AdminVpnPage({ searchParams }: PageProps) {
  await requireAdmin();
  const supabase = getServiceSupabaseClient();
  const q = (searchParams?.q ?? '').trim();
  const tab = searchParams?.tab === 'expired' ? 'expired' : 'active';

  let servers: Awaited<ReturnType<typeof listServers>> = [];
  let setupError: string | null = null;
  try {
    servers = await listServers();
  } catch (e: any) {
    setupError = e?.message ?? String(e);
  }

  // Current keys → customers per server
  const { data: currentKeys, error: keysErr } = await supabase
    .from('vpn_keys')
    .select('id,subscription_id,vpn_server_id,used_bytes')
    .eq('is_current', true)
    .limit(5000);
  if (keysErr && !setupError) setupError = keysErr.message;
  const keyBySub: Record<string, any> = {};
  const countByServer: Record<string, number> = {};
  for (const k of (currentKeys ?? []) as any[]) {
    if (k.subscription_id) keyBySub[k.subscription_id] = k;
    if (k.vpn_server_id) countByServer[k.vpn_server_id] = (countByServer[k.vpn_server_id] ?? 0) + 1;
  }

  // Plans list
  let subQuery = supabase
    .from('vpn_subscriptions')
    .select('id,code,user_id,source,customer_note,plan_name,country,data_limit_bytes,period_used_prior_bytes,period_days,period_started_at,starts_at,expires_at,status,created_at')
    .order('created_at', { ascending: false })
    .limit(150);
  if (q) {
    const safe = q.replace(/[,()*]/g, ' ');
    subQuery = subQuery.or(`code.ilike.*${safe}*,customer_note.ilike.*${safe}*,plan_name.ilike.*${safe}*`);
  } else if (tab === 'active') {
    subQuery = subQuery.eq('status', 'active');
  } else {
    subQuery = subQuery.in('status', ['expired', 'revoked']);
  }
  const { data: subRows, error: subsErr } = await subQuery;
  if (subsErr && !setupError) setupError = subsErr.message;
  const subs = (subRows ?? []) as any[];

  // Emails for website customers
  const userIds = Array.from(new Set(subs.map((s) => s.user_id).filter(Boolean)));
  const emailById: Record<string, string> = {};
  if (userIds.length) {
    const { data: users } = await supabase.from('users').select('id,email').in('id', userIds);
    for (const u of (users ?? []) as any[]) emailById[u.id] = u.email;
  }

  let stockRows: Awaited<ReturnType<typeof getVpnStock>>[string][] = [];
  try {
    stockRows = Object.values(await getVpnStock()).sort((a, b) => a.country.localeCompare(b.country));
  } catch {
    stockRows = [];
  }

  const serverLabel = (s: any) => `${s.name || 'Server'} · ${s.country || '?'}`;
  const activeServers = servers.filter((s) => s.is_active !== false);
  const serverById: Record<string, any> = Object.fromEntries(servers.map((s) => [s.id, s]));

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">VPN (Outline)</h1>
          <p className="text-sm text-slate-400">Servers, customer keys, and monthly server moves.</p>
        </div>
        <Link href="/admin" className="text-xs text-emerald-400 hover:text-emerald-300">
          ← Admin
        </Link>
      </div>

      {setupError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Database not ready: {setupError}. Run <code>supabase/migrations/0002_vpn_subscriptions.sql</code> in the Supabase SQL editor.
        </div>
      )}

      {/* Stock */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Stock (what customers can buy)</h2>
        <VpnStockPanel rows={stockRows} action={setVpnStockAction} />
      </section>

      {/* Servers */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Servers</h2>
        {servers.length === 0 && <p className="text-sm text-slate-400">No servers yet.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {servers.map((s) => {
            const daysLeft = s.paid_until
              ? Math.ceil((new Date(s.paid_until).getTime() - Date.now()) / DAY_MS)
              : null;
            const customers = countByServer[s.id] ?? 0;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border p-4 ${s.is_active === false ? 'border-slate-800 bg-slate-900/30 opacity-70' : 'border-slate-800 bg-slate-900'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-100">{serverLabel(s)}</p>
                    <p className="mt-0.5 break-all text-[11px] text-slate-500">{String(s.api_url).replace(/\/[^/]+$/, '/•••')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${s.is_active === false ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {s.is_active === false ? 'Off' : 'On'}
                    </span>
                    {s.is_backup && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">Backup</span>
                    )}
                    {s.is_active !== false && (s.health_fail_count ?? 0) >= 2 && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-300">Down</span>
                    )}
                    {s.pending_move_to && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">Moving…</span>
                    )}
                    {s.is_active !== false && !s.is_backup && s.accepting_new === false && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">No new sales</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
                  <span>👥 {customers} key{customers === 1 ? '' : 's'}</span>
                  <span className={daysLeft != null && daysLeft <= 3 ? 'font-semibold text-amber-300' : ''}>
                    💳 Paid until {s.paid_until ?? '—'}
                    {daysLeft != null ? ` (${daysLeft}d)` : ''}
                  </span>
                  <span className="text-slate-500">
                    Checked {s.last_health_at ? new Date(s.last_health_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' }) : 'never'}
                  </span>
                </div>
                <ServerControls
                  serverId={s.id}
                  paidUntil={s.paid_until}
                  acceptingNew={s.accepting_new !== false}
                  isActive={s.is_active !== false}
                  isBackup={s.is_backup === true}
                  activeCustomers={customers}
                  otherServers={activeServers.filter((o) => o.id !== s.id).map((o) => ({ id: o.id, label: serverLabel(o) }))}
                  updateAction={updateServerAction}
                  moveAction={moveAllAction}
                />
              </div>
            );
          })}
        </div>

        <details className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-300">+ Add new server</summary>
          <p className="mt-2 text-xs text-slate-400">
            In Outline Manager, open the server → Settings → copy the <b>Management API URL</b>.
          </p>
          <div className="mt-3">
            <AddServerForm action={addServerAction} />
          </div>
        </details>
      </section>

      {/* Manual key */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold text-slate-100">Create key for Viber / Telegram customer</h2>
        <p className="mb-3 text-xs text-slate-400">Creates the key and a status link you can send them. The link stops working after expiry.</p>
        <CreateManualKeyForm
          action={createManualKeyAction}
          servers={activeServers.map((s) => ({ id: s.id, label: serverLabel(s), country: s.country || '' }))}
        />
      </section>

      {/* Plans */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 text-sm">
            <Link
              href="/admin/vpn?tab=active"
              className={`rounded-lg px-3 py-1.5 ${tab === 'active' && !q ? 'bg-emerald-500 font-semibold text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Active
            </Link>
            <Link
              href="/admin/vpn?tab=expired"
              className={`rounded-lg px-3 py-1.5 ${tab === 'expired' && !q ? 'bg-emerald-500 font-semibold text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Expired
            </Link>
          </div>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search code / customer note / plan"
              className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
            <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-emerald-400">Search</button>
          </form>
        </div>

        {subs.length === 0 && <p className="text-sm text-slate-400">No plans here.</p>}

        <div className="space-y-2">
          {subs.map((s) => {
            const key = keyBySub[s.id];
            const server = key ? serverById[key.vpn_server_id] : null;
            const used = Number(s.period_used_prior_bytes || 0) + Number(key?.used_bytes || 0);
            const limit = Number(s.data_limit_bytes || 0);
            const active = !isExpired(s);
            const daysLeft = Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / DAY_MS));
            const who = s.customer_note || emailById[s.user_id] || '—';
            return (
              <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {who}{' '}
                      <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal uppercase text-slate-400">
                        {s.source === 'manual' ? 'Viber/TG' : 'Website'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {s.plan_name || 'VPN'} · {server ? serverLabel(server) : 'no key'} · code {s.code}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={active ? (daysLeft <= 3 ? 'font-semibold text-amber-300' : 'text-emerald-300') : 'text-slate-500'}>
                      {active ? `${daysLeft}d left` : s.status} · ends {fmtDate(s.expires_at)}
                    </p>
                    <p className="text-slate-400">
                      {fmtGb(used)} / {limit > 0 ? fmtGb(limit) : '∞'} {isWholePlanData(s) ? 'total' : 'this month'}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton value={statusPageUrl(s.code)} label="Copy link" />
                  <CopyButton value={dynamicKeyFor(s.code)} label="Copy key" />
                  <CopyButton value={subscriptionLinkFor(s.code)} label="Copy Hiddify/V2Box link" />
                  <a href={`/vpn/${s.code}`} target="_blank" className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-emerald-400">
                    Open page
                  </a>
                </div>
                <SubscriptionActions
                  subscriptionId={s.id}
                  active={active}
                  servers={activeServers.map((x) => ({ id: x.id, label: serverLabel(x) }))}
                  replaceAction={adminReplaceKeyAction}
                  expiresAt={s.expires_at}
                  extendAction={extendAction}
                  setExpiryAction={setExpiryDateAction}
                  revokeAction={revokeAction}
                />
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
