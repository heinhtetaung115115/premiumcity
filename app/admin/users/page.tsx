// app/admin/users/page.tsx
import type { HTMLAttributes } from 'react';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { listOrdersForUser } from '@/lib/orders';
import { getWalletPageData } from '@/lib/wallet';
import { Button } from '@/components/ui';
import { credentialToRows } from '@/lib/deliveryTypes';
import { AdminTopupForm } from './AdminTopupForm';

type PageProps = {
  searchParams?: {
    email?: string;
  };
};

export const dynamic = 'force-dynamic';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

function monthsSince(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} yr${years === 1 ? '' : 's'}${remMonths ? ` ${remMonths} mo` : ''} ago`;
}

type PanelProps = HTMLAttributes<HTMLDivElement>;
function Panel({ className = '', ...props }: PanelProps) {
  return (
    <div className={'rounded-2xl border border-slate-800 bg-slate-900 ' + (className ?? '')} {...props} />
  );
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const emailFilter =
    typeof searchParams?.email === 'string' ? searchParams.email.trim() : '';

  const supabase = getServiceSupabaseClient();

  type UserRow = {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    avatar_url: string | null;
  };

  // Search happens IN THE DATABASE so it covers every user, not just a page of
  // them. (This previously loaded the newest 1000 users and filtered in JS, so
  // anyone outside that window was unfindable.)
  let matches: UserRow[] = [];

  if (emailFilter) {
    // Strip characters that would break PostgREST's or=(...) syntax.
    const safe = emailFilter.replace(/[(),"*]/g, '').trim();

    if (safe) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id,email,name,created_at,avatar_url')
          .or(`email.ilike.*${safe}*,name.ilike.*${safe}*`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        matches = (data ?? []) as UserRow[];
      } catch (err) {
        console.error('admin/users: db search failed, falling back:', err);
        // Fallback: scan a page of users in JS. Not exhaustive, but better
        // than showing nothing if the OR filter isn't supported.
        try {
          const { data } = await supabase
            .from('users')
            .select('id,email,name,created_at,avatar_url')
            .order('created_at', { ascending: false })
            .limit(1000);
          const q = safe.toLowerCase();
          matches = ((data ?? []) as UserRow[])
            .filter(
              (u) =>
                (typeof u.email === 'string' && u.email.toLowerCase().includes(q)) ||
                (typeof u.name === 'string' && u.name.toLowerCase().includes(q))
            )
            .slice(0, 20);
        } catch (err2) {
          console.error('admin/users: fallback search failed:', err2);
          matches = [];
        }
      }
    }
  }

  // Exact match is auto-selected; otherwise if exactly one partial match, select it.
  const exact = matches.find((u) => u.email?.toLowerCase() === emailFilter.toLowerCase());
  const user = exact ?? (matches.length === 1 ? matches[0] : null);

  let orders: any[] = [];
  if (user) {
    try {
      orders = await listOrdersForUser(user.id);
    } catch (err) {
      console.error('admin/users: listOrdersForUser failed:', err);
      orders = [];
    }
  }

  // Wallet + derived stats (same helper the customer wallet page uses)
  let balance = 0;
  let walletTopups: any[] = [];
  let walletSpending: any[] = [];
  let walletToppedUp = 0;
  let walletSpent = 0;
  if (user) {
    try {
      const ov = await getWalletPageData(user.id);
      balance = ov.balance;
      walletTopups = ov.topups;
      walletSpending = ov.spending;
      walletToppedUp = ov.totalToppedUp;
      walletSpent = ov.totalSpent;
    } catch {
      balance = 0;
    }
  }

  const completedOrders = orders.filter(
    (o: any) => String(o.status).toUpperCase() === 'COMPLETED'
  );
  const totalSpent = completedOrders.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount || 0),
    0
  );
  const lastOrder = orders[0];

  const hasFilter = !!emailFilter;
  const showList = hasFilter && !user && matches.length > 1;
  const noUser = hasFilter && matches.length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Users &amp; Orders</h1>
        <p className="text-sm text-slate-400">
          Search by email or name (partial works) to view a full profile and all orders.
        </p>
      </header>

      {/* Search bar */}
      <Panel className="border-[#26344e] bg-[#151e30] p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#26344e] bg-[#0d1420] px-3 py-2.5 focus-within:border-emerald-500">
            <svg className="h-4 w-4 flex-shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              name="email"
              placeholder="Type part of an email or name…"
              defaultValue={emailFilter}
              className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {hasFilter && (
              <a
                href="/admin/users"
                className="inline-flex items-center rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
              >
                Clear
              </a>
            )}
          </div>
        </form>
      </Panel>

      {!hasFilter && (
        <Panel className="p-4 text-sm text-slate-400">
          Type any part of a user&apos;s email or name and press Search.
        </Panel>
      )}

      {noUser && (
        <Panel className="p-4 text-sm text-rose-300">
          No user found matching: <span className="font-mono">{emailFilter}</span>
        </Panel>
      )}

      {/* Multiple matches — pick one */}
      {showList && (
        <Panel className="p-4">
          <p className="mb-3 text-sm text-slate-300">
            {matches.length} users match &quot;{emailFilter}&quot; — pick one:
          </p>
          <div className="space-y-2">
            {matches.map((u) => (
              <a
                key={u.id}
                href={`/admin/users?email=${encodeURIComponent(u.email)}`}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition hover:border-emerald-500/50"
              >
                <span className="h-8 w-8 overflow-hidden rounded-full bg-slate-800">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-emerald-400">
                      {(u.name || u.email || '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{u.email}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {u.name || 'No name'} · joined {formatDay(u.created_at)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {/* User profile + stats */}
      {user && (
        <>
          <Panel className="border-[#26344e] bg-gradient-to-br from-[#1a2438] to-[#151e30] p-5">
            <div className="flex items-center gap-4">
              <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-slate-800">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-slate-950">
                    {(user.name || user.email || '?').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-slate-50">
                  {user.name || <span className="italic text-slate-500">No name set</span>}
                </p>
                <p className="truncate font-mono text-sm text-slate-400">{user.email}</p>
              </div>
              <span className="flex-shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold text-emerald-300">
                ● Active
              </span>
            </div>

            {/* Stat grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" strokeLinecap="round" />
                  </svg>
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">Balance</span>
                </div>
                <p className="text-lg font-bold text-emerald-400">
                  {balance.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
              </div>

              <div className="rounded-xl border border-[#26344e] bg-[#0d1420] p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 6z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">Orders</span>
                </div>
                <p className="text-lg font-bold text-slate-100">{orders.length}</p>
                <p className="text-[10px] text-slate-500">{completedOrders.length} completed</p>
              </div>

              <div className="rounded-xl border border-[#26344e] bg-[#0d1420] p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">Spent</span>
                </div>
                <p className="text-lg font-bold text-slate-100">
                  {totalSpent.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
                <p className="text-[10px] text-slate-500">completed only</p>
              </div>

              <div className="rounded-xl border border-[#26344e] bg-[#0d1420] p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  </svg>
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">Joined</span>
                </div>
                <p className="text-sm font-bold text-slate-100">{formatDay(user.created_at)}</p>
                <p className="text-[10px] text-slate-500">{monthsSince(user.created_at)}</p>
              </div>
            </div>

            {lastOrder && (
              <p className="mt-3 text-[11px] text-slate-500">
                Last order: {formatDate(lastOrder.createdAt)} · {String(lastOrder.status)}
              </p>
            )}
          </Panel>

          {/* Wallet history */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Wallet history</h2>

            <AdminTopupForm userId={user.id} />

            <div className="grid grid-cols-2 gap-3">
              <Panel className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Topped up</p>
                <p className="mt-1 text-base font-bold text-emerald-400">
                  {walletToppedUp.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
              </Panel>
              <Panel className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Wallet spent</p>
                <p className="mt-1 text-base font-bold text-rose-400">
                  {walletSpent.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
              </Panel>
            </div>

            {/* Top-ups */}
            <Panel className="p-4">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">
                    Top-ups ({walletTopups.length})
                  </span>
                  <span className="text-xs text-slate-500">show / hide</span>
                </summary>
                <div className="mt-3 border-t border-slate-800 pt-3">
                  {walletTopups.length === 0 ? (
                    <p className="text-xs text-slate-500">No top-ups yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {walletTopups.map((t: any) => {
                        const st = String(t.status).toUpperCase();
                        const ok = st === 'APPROVED' || st === 'CREDITED';
                        const pending = st === 'PENDING';
                        return (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-200">
                                {t.source === 'CRYPTO' ? 'Crypto top-up' : 'Bank top-up'}
                                <span
                                  className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                    ok
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : pending
                                      ? 'bg-amber-500/15 text-amber-300'
                                      : 'bg-rose-500/15 text-rose-300'
                                  }`}
                                >
                                  {st}
                                </span>
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                {formatDate(t.createdAt)}
                                {t.detail ? ` · ${t.detail}` : ''}
                              </p>
                            </div>
                            <span
                              className={`flex-shrink-0 text-xs font-semibold ${
                                ok ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {ok ? '+' : ''}
                              {Number(t.amount).toLocaleString('en-US')} Ks
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </details>
            </Panel>

            {/* Spending */}
            <Panel className="p-4">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">
                    Spending ({walletSpending.length})
                  </span>
                  <span className="text-xs text-slate-500">show / hide</span>
                </summary>
                <div className="mt-3 border-t border-slate-800 pt-3">
                  {walletSpending.length === 0 ? (
                    <p className="text-xs text-slate-500">No wallet spending yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {walletSpending.map((sp: any) => (
                        <li
                          key={sp.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-200">
                              {sp.description || 'Purchase'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {formatDate(sp.createdAt)}
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-xs font-semibold text-rose-400">
                            -{Number(sp.amount).toLocaleString('en-US')} Ks
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </Panel>
          </section>

          {/* Orders */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Orders ({orders.length})</h2>

            {orders.length === 0 ? (
              <Panel className="p-4 text-sm text-slate-400">This user has no orders yet.</Panel>
            ) : (
              orders.map((order: any) => (
                <Panel key={order.id} className="p-4">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-slate-400">
                          {String(order.id).slice(0, 8)}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                          {order.status}
                        </span>
                        <span className="text-sm font-semibold text-emerald-400">
                          {order.totalAmount.toLocaleString('en-US')} Ks
                        </span>
                      </div>
                    </summary>

                    <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-sm">
                      {order.items.length === 0 ? (
                        <p className="text-xs text-slate-500">No items recorded for this order.</p>
                      ) : (
                        <ul className="space-y-3">
                          {order.items.map((item: any) => (
                            <li
                              key={item.id}
                              className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-100">
                                    {item.productName}
                                    {item.variantName ? ` · ${item.variantName}` : ''}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Type: {item.productType} · Qty: {item.quantity}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs uppercase text-slate-500">Unit</p>
                                  <p className="font-semibold text-slate-200">
                                    {item.unitPrice.toLocaleString('en-US')} Ks
                                  </p>
                                </div>
                              </div>

                              {item.credentials.length > 0 && (
                                <div className="mt-2 text-xs text-slate-200">
                                  <p className="mb-1 font-semibold text-emerald-300">
                                    Delivered credentials ({item.credentials.length}):
                                  </p>
                                  <ul className="space-y-1">
                                    {item.credentials.map((cred: any, idx: number) => {
                                      const rows = credentialToRows(cred);
                                      return (
                                        <li
                                          key={idx}
                                          className="rounded border border-slate-800 bg-slate-950 px-2 py-1"
                                        >
                                          <p className="text-[11px] text-slate-400">
                                            Credential #{idx + 1}
                                          </p>
                                          {rows.length > 0 ? (
                                            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                                              {rows.map((row) => (
                                                <li key={row.label}>
                                                  <span className="text-slate-500">{row.label}:</span>{' '}
                                                  {row.value}
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300">
                                              {JSON.stringify(cred, null, 2)}
                                            </pre>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}

                              {item.manualInput &&
                                Object.keys(item.manualInput).length > 0 && (
                                  <div className="mt-2 text-xs text-slate-400">
                                    <p className="mb-1 font-semibold text-slate-300">Manual input:</p>
                                    <ul className="space-y-0.5">
                                      {Object.entries(item.manualInput).map(([k, v]) => (
                                        <li key={k}>
                                          <span className="text-slate-500">{k}:</span> {String(v)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </Panel>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
