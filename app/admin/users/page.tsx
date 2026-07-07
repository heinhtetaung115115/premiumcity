// app/admin/users/page.tsx
import type { HTMLAttributes } from 'react';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { listOrdersForUser } from '@/lib/orders';
import { getWalletOverview } from '@/lib/wallet';
import { Input, Button } from '@/components/ui';
import { credentialToRows } from '@/lib/deliveryTypes';

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

  // Load users newest-first so recent signups are included.
  // Wrapped defensively so a query hiccup can't blank the whole page.
  let allUsers: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    avatar_url: string | null;
  }[] = [];

  try {
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id,email,name,created_at,avatar_url')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (usersError) throw usersError;
    allUsers = (usersData ?? []) as typeof allUsers;
  } catch (err) {
    console.error('admin/users: failed to load users:', err);
    // Fallback: try a minimal select in case avatar_url or ordering caused it.
    try {
      const { data: fallback } = await supabase
        .from('users')
        .select('id,email,name,created_at')
        .limit(1000);
      allUsers = ((fallback ?? []) as any[]).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        created_at: u.created_at,
        avatar_url: null,
      }));
    } catch (err2) {
      console.error('admin/users: fallback user load also failed:', err2);
      allUsers = [];
    }
  }

  // PARTIAL, case-insensitive match on email OR name. Show up to 20 matches.
  let matches: typeof allUsers = [];
  if (emailFilter) {
    const q = emailFilter.toLowerCase();
    matches = allUsers
      .filter(
        (u) =>
          (typeof u.email === 'string' && u.email.toLowerCase().includes(q)) ||
          (typeof u.name === 'string' && u.name.toLowerCase().includes(q))
      )
      .slice(0, 20);
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

  // Wallet + derived stats
  let balance = 0;
  if (user) {
    try {
      const ov = await getWalletOverview(user.id);
      balance = ov.balance;
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
      <Panel className="p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <div className="flex-1">
            <label className="text-xs uppercase text-slate-500">Email or name</label>
            <Input
              name="email"
              placeholder="Type part of an email or name…"
              defaultValue={emailFilter}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {hasFilter && (
              <a
                href="/admin/users"
                className="inline-flex items-center rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
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
          <Panel className="p-5">
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
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-50">
                  {user.name || <span className="italic text-slate-500">No name set</span>}
                </p>
                <p className="truncate font-mono text-sm text-slate-400">{user.email}</p>
              </div>
            </div>

            {/* Stat grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Wallet balance</p>
                <p className="mt-1 text-lg font-bold text-emerald-400">
                  {balance.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Total orders</p>
                <p className="mt-1 text-lg font-bold text-slate-100">{orders.length}</p>
                <p className="text-[10px] text-slate-500">{completedOrders.length} completed</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Total spent</p>
                <p className="mt-1 text-lg font-bold text-slate-100">
                  {totalSpent.toLocaleString('en-US')} <span className="text-xs">Ks</span>
                </p>
                <p className="text-[10px] text-slate-500">completed only</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Member since</p>
                <p className="mt-1 text-sm font-bold text-slate-100">{formatDay(user.created_at)}</p>
                <p className="text-[10px] text-slate-500">{monthsSince(user.created_at)}</p>
              </div>
            </div>

            {lastOrder && (
              <p className="mt-3 text-[11px] text-slate-500">
                Last order: {formatDate(lastOrder.createdAt)} · {String(lastOrder.status)}
              </p>
            )}
          </Panel>

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
