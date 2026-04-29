// app/admin/orders/page.tsx
import { requireAdmin } from '@/lib/session';
import { listOrdersForAdmin } from '@/lib/orders';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fulfillManualItemAction } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: {
    orderId?: string;
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
    minute: '2-digit',
  });
}

function isUuid(v: string) {
  // Accepts UUID v1–v5; case-insensitive
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// Wrapper server action that matches the expected type: Promise<void>
async function fulfillManualItemFormAction(formData: FormData): Promise<void> {
  'use server';
  await fulfillManualItemAction(formData);
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const rawOrderId =
    typeof searchParams?.orderId === 'string' ? searchParams.orderId.trim() : '';

  const hasFilter = !!rawOrderId;

  // If admin typed something that is not a UUID, do not query Supabase with it (prevents 400 Bad Request)
  const invalidFilter = hasFilter && !isUuid(rawOrderId);

  let orders: any[] = [];

  if (!invalidFilter) {
    try {
      orders = await listOrdersForAdmin(hasFilter ? { orderId: rawOrderId } : {});
    } catch (err: any) {
      // This ensures Vercel logs show details if listOrdersForAdmin throws
      console.error('[admin/orders] listOrdersForAdmin failed:', {
        message: err?.message,
        name: err?.name,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        status: err?.status,
        stack: err?.stack,
      });
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-400">
          View all orders. For manual products, you can paste final credentials and mark orders as completed.
        </p>
      </header>

      {/* Search by Order ID */}
      <Card className="p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs uppercase text-slate-500">Order ID</label>
            <Input
              name="orderId"
              placeholder="Enter full order id (UUID)"
              defaultValue={rawOrderId}
              className="mt-1"
            />
            {invalidFilter && (
              <p className="mt-2 text-xs text-rose-400">
                Invalid Order ID format. Please paste a full UUID (example: 8-4-4-4-12).
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {hasFilter && (
              <a
                href="/admin/orders"
                className="inline-flex items-center rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
              >
                Clear
              </a>
            )}
          </div>
        </form>
      </Card>

      {/* No orders / invalid filter */}
      {invalidFilter ? (
        <Card className="p-4 text-sm text-slate-400">
          No search executed because the Order ID is not a valid UUID.
        </Card>
      ) : orders.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">
          {hasFilter ? 'No orders found for this Order ID.' : 'No orders yet.'}
        </Card>
      ) : null}

      {/* Orders list */}
      {!invalidFilter &&
        orders.map((order) => (
          <Card key={order.id} className="p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-mono text-sm text-slate-100">Order ID: {order.id}</span>
                <span className="text-xs text-slate-500">
                  {formatDate(order.createdAt)} · Status{' '}
                  <span className="font-medium text-slate-200">{order.status}</span>
                </span>
              </summary>

              <div className="mt-4 space-y-3 border-t border-slate-800 pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total amount</span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {order.totalAmount.toLocaleString('en-US')} MMK
                  </span>
                </div>

                {order.items.length === 0 ? (
                  <p className="text-xs text-slate-500">No items recorded for this order.</p>
                ) : (
                  <ul className="space-y-3">
                    {order.items.map((item: any) => {
                      const isManual = item.productType === 'MANUAL';
                      const hasCreds = item.credentials.length > 0;

                      return (
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
                                {item.unitPrice.toLocaleString('en-US')} MMK
                              </p>
                            </div>
                          </div>

                          {/* Manual input */}
                          {item.manualInput && Object.keys(item.manualInput).length > 0 && (
                            <div className="mt-2 text-xs text-slate-400">
                              <p className="mb-1 font-semibold text-slate-300">User input:</p>
                              <ul className="space-y-0.5">
                                {Object.entries(item.manualInput).map(([k, v]: any) => (
                                  <li key={k}>
                                    <span className="text-slate-500">{k}:</span> {String(v)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Delivered credentials */}
                          {hasCreds && (
                            <div className="mt-2 text-xs text-slate-200">
                              <p className="mb-1 font-semibold text-emerald-300">
                                Delivered credentials ({item.credentials.length}):
                              </p>
                              <ul className="space-y-1">
                                {item.credentials.map((cred: any, idx: number) => {
                                  const c = cred || {};
                                  const hasStandard = 'email' in c || 'password' in c || 'note' in c;

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
                                              <span className="text-slate-500">email:</span>{' '}
                                              {String(c.email)}
                                            </li>
                                          )}
                                          {'password' in c && (
                                            <li>
                                              <span className="text-slate-500">password:</span>{' '}
                                              {String(c.password)}
                                            </li>
                                          )}
                                          {'note' in c && c.note && (
                                            <li>
                                              <span className="text-slate-500">note:</span>{' '}
                                              {String(c.note)}
                                            </li>
                                          )}
                                        </ul>
                                      ) : (
                                        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300">
                                          {JSON.stringify(c, null, 2)}
                                        </pre>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {/* Fulfill form only for MANUAL items without credentials */}
                          {isManual && !hasCreds && (
                            <div className="mt-3 border-t border-slate-800 pt-3">
                              <p className="mb-2 text-xs font-semibold text-slate-300">
                                Fulfill manual product
                              </p>
                              <form action={fulfillManualItemFormAction} className="grid gap-2 md:grid-cols-3">
                                <input type="hidden" name="orderItemId" value={item.id} />
                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-slate-500">
                                    Email (optional)
                                  </label>
                                  <Input name="email" placeholder="customer@example.com" className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-slate-500">
                                    Password (optional)
                                  </label>
                                  <Input name="password" placeholder="password" className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1 md:col-span-3 lg:col-span-1">
                                  <label className="text-[11px] uppercase text-slate-500">
                                    Note (optional)
                                  </label>
                                  <Input name="note" placeholder="Profile, region, extra notes…" className="h-8 text-xs" />
                                </div>
                                <div className="md:col-span-3 flex justify-end pt-1">
                                  <Button type="submit" className="px-3 py-1.5 text-xs">
                                    Save &amp; deliver
                                  </Button>
                                </div>
                              </form>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </details>
          </Card>
        ))}
    </div>
  );
}
