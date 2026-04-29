// app/admin/users/page.tsx
import type { HTMLAttributes } from 'react';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { listOrdersForUser } from '@/lib/orders';
import { Input, Button } from '@/components/ui';

type PageProps = {
  searchParams?: {
    email?: string;
  };
};

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

// Simple local "card" wrapper so we don't rely on Card typings
type PanelProps = HTMLAttributes<HTMLDivElement>;

function Panel({ className = '', ...props }: PanelProps) {
  return (
    <div
      className={
        'rounded-2xl border border-slate-800 bg-slate-900 ' +
        (className ?? '')
      }
      {...props}
    />
  );
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const emailFilter =
    typeof searchParams?.email === 'string'
      ? searchParams.email.trim()
      : '';

  const supabase = getServiceSupabaseClient();

  // --- 1) Load a small list of users (no DB filter, we filter in JS) ---
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id,email,name,created_at')
    .order('created_at', { ascending: true })
    .limit(200); // more than enough for your admin panel

  if (usersError) throw usersError;

  const allUsers =
    (usersData ?? []) as {
      id: string;
      email: string;
      name: string | null;
      created_at: string;
    }[];

  let user:
    | { id: string; email: string; name: string | null; created_at: string }
    | null = null;

  if (emailFilter) {
    const target = emailFilter.toLowerCase();
    user =
      allUsers.find(
        (u) =>
          typeof u.email === 'string' &&
          u.email.toLowerCase() === target
      ) ?? null;
  }

  // --- 2) If we found a user, get their orders by userId (same as /orders page) ---
  const orders = user ? await listOrdersForUser(user.id) : [];

  const hasFilter = !!emailFilter;
  const noUser = hasFilter && !user;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Users &amp; Orders</h1>
        <p className="text-sm text-slate-400">
          Search by email to view a user profile and all of their orders
          (including delivered credentials).
        </p>
      </header>

      {/* Search bar */}
      <Panel className="p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          method="get"
        >
          <div className="flex-1">
            <label className="text-xs uppercase text-slate-500">
              User email
            </label>
            <Input
              name="email"
              placeholder="user@example.com"
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

      {/* State: nothing searched yet */}
      {!hasFilter && (
        <Panel className="p-4 text-sm text-slate-400">
          Enter the full email address and press Search.
        </Panel>
      )}

      {/* State: no user found */}
      {noUser && (
        <Panel className="p-4 text-sm text-rose-300">
          No user found matching:{' '}
          <span className="font-mono">{emailFilter}</span>
        </Panel>
      )}

      {/* User profile + orders */}
      {user && (
        <>
          {/* User profile */}
          <Panel className="p-4">
            <h2 className="text-lg font-semibold text-slate-100">
              User profile
            </h2>
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <span className="text-slate-500">Email:</span>{' '}
                <span className="font-mono">{user.email}</span>
              </p>
              <p>
                <span className="text-slate-500">Name:</span>{' '}
                {user.name ?? (
                  <span className="italic text-slate-500">none</span>
                )}
              </p>
              <p>
                <span className="text-slate-500">Created:</span>{' '}
                {formatDate(user.created_at)}
              </p>
            </div>
          </Panel>

          {/* Orders for this user */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Orders for this user
            </h2>

            {orders.length === 0 ? (
              <Panel className="p-4 text-sm text-slate-400">
                This user has no orders yet.
              </Panel>
            ) : (
              orders.map((order) => (
                <Panel key={order.id} className="p-4">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between">
                      <span className="font-mono text-sm text-slate-100">
                        Order ID: {order.id}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(order.createdAt)} · Status:{' '}
                        <span className="font-medium text-slate-200">
                          {order.status}
                        </span>
                      </span>
                    </summary>

                    <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          Total:
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">
                          {order.totalAmount.toLocaleString('en-US')} MMK
                        </span>
                      </div>

                      {order.items.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No items recorded for this order.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {order.items.map((item) => (
                            <li
                              key={item.id}
                              className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-100">
                                    {item.productName}
                                    {item.variantName
                                      ? ` · ${item.variantName}`
                                      : ''}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Type: {item.productType} · Qty:{' '}
                                    {item.quantity}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs uppercase text-slate-500">
                                    Unit
                                  </p>
                                  <p className="font-semibold text-slate-200">
                                    {item.unitPrice.toLocaleString(
                                      'en-US'
                                    )}{' '}
                                    MMK
                                  </p>
                                </div>
                              </div>

                              {/* Credentials */}
                              {item.credentials.length > 0 && (
                                <div className="mt-2 text-xs text-slate-200">
                                  <p className="mb-1 font-semibold text-emerald-300">
                                    Delivered credentials (
                                    {item.credentials.length}):
                                  </p>
                                  <ul className="space-y-1">
                                    {item.credentials.map(
                                      (cred: any, idx: number) => {
                                        const c = cred || {};
                                        const hasStandard =
                                          'email' in c ||
                                          'password' in c ||
                                          'note' in c;
                                        return (
                                          <li
                                            key={idx}
                                            className="rounded border border-slate-800 bg-slate-950 px-2 py-1"
                                          >
                                            <p className="text-[11px] text-slate-400">
                                              Credential #{idx + 1}
                                            </p>
                                            {hasStandard ? (
                                              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                                                {'email' in c && (
                                                  <li>
                                                    <span className="text-slate-500">
                                                      email:
                                                    </span>{' '}
                                                    {String(c.email)}
                                                  </li>
                                                )}
                                                {'password' in c && (
                                                  <li>
                                                    <span className="text-slate-500">
                                                      password:
                                                    </span>{' '}
                                                    {String(c.password)}
                                                  </li>
                                                )}
                                                {'note' in c &&
                                                  c.note && (
                                                    <li>
                                                      <span className="text-slate-500">
                                                        note:
                                                      </span>{' '}
                                                      {String(c.note)}
                                                    </li>
                                                  )}
                                              </ul>
                                            ) : (
                                              <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300">
                                                {JSON.stringify(
                                                  c,
                                                  null,
                                                  2
                                                )}
                                              </pre>
                                            )}
                                          </li>
                                        );
                                      }
                                    )}
                                  </ul>
                                </div>
                              )}

                              {/* Manual input */}
                              {item.manualInput &&
                                Object.keys(item.manualInput).length >
                                  0 && (
                                  <div className="mt-2 text-xs text-slate-400">
                                    <p className="mb-1 font-semibold text-slate-300">
                                      Manual input:
                                    </p>
                                    <ul className="space-y-0.5">
                                      {Object.entries(
                                        item.manualInput
                                      ).map(([k, v]) => (
                                        <li key={k}>
                                          <span className="text-slate-500">
                                            {k}:
                                          </span>{' '}
                                          {String(v)}
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
