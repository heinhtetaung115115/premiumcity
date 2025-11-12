import { requireAuth } from '@/lib/session';
import { listOrdersForUser } from '@/lib/orders';
import { formatCurrency } from '@/utils/currency';
import { Card } from '@/components/ui';
import { CopyField } from '@/components/copy-field';

export default async function OrdersPage() {
  const session = await requireAuth();
  const orders = await listOrdersForUser(session.user.id!);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Order history</h1>
        <p className="text-sm text-slate-400">Track instant deliveries and manual fulfillment updates.</p>
      </header>
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Order #{order.orderNumber}</p>
                <p className="text-lg font-medium text-slate-100">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-400">Total</p>
                <p className="text-lg font-semibold text-emerald-300">{formatCurrency(Number(order.total))}</p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {order.orderItems.map((item) => {
                const credentials = (item.deliveredData as { credentials?: Record<string, string>[] } | null)?.credentials ?? [];
                const manualFields = item.manualInput as Record<string, string> | null;
                return (
                  <div key={item.id} className="rounded border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-100">{item.product.name}</p>
                        <p className="text-sm text-slate-400">{item.variant?.name}</p>
                      </div>
                      <div className="text-sm uppercase text-slate-400">{item.deliveryStatus}</div>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Payment method: wallet · Quantity: {item.quantity}
                    </p>
                    {credentials.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {credentials.map((credential, index) => (
                          <div key={index} className="space-y-2">
                            {Object.entries(credential).map(([label, value]) => (
                              <CopyField key={label} label={label} value={String(value)} />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {manualFields && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase text-slate-500">Submitted details</p>
                        {Object.entries(manualFields).map(([label, value]) => (
                          <div key={label} className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                            <span className="text-slate-500">{label}</span>: {value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        {orders.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">No orders yet. Browse the catalog to place your first order.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
