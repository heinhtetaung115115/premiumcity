import { listOrdersForAdmin } from '@/lib/orders';
import { Button, Card, TextArea } from '@/components/ui';
import { formatCurrency } from '@/utils/currency';
import { deliverManualOrder } from './actions';

export default async function AdminOrdersPage() {
  const orders = await listOrdersForAdmin();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-400">Search by order number or customer email via your browser find (Ctrl/Cmd + F).</p>
      </header>
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Order #{order.orderNumber}</p>
                <p className="text-lg font-medium text-slate-100">
                  {order.user.email} · {new Date(order.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-slate-400">Status: {order.status}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-400">Total</p>
                <p className="text-lg font-semibold text-emerald-300">{formatCurrency(Number(order.total))}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {order.orderItems.map((item) => (
                <div key={item.id} className="rounded border border-slate-800 px-3 py-2">
                  <p className="font-medium text-slate-100">{item.product.name}</p>
                  <p className="text-xs uppercase text-slate-500">{item.deliveryStatus}</p>
                  {item.manualInput && (
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950/60 p-2 text-xs text-slate-400">
                      {JSON.stringify(item.manualInput, null, 2)}
                    </pre>
                  )}
                  {item.deliveredData && (
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950/60 p-2 text-xs text-emerald-300">
                      {JSON.stringify(item.deliveredData, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
            {order.status !== 'FULFILLED' && (
              <form action={deliverManualOrder} className="mt-4 space-y-2 text-sm">
                <input type="hidden" name="orderId" value={order.id} />
                <TextArea
                  name="payload"
                  rows={4}
                  placeholder='{"email":"customer@example.com","password":"newpass"}'
                  required
                />
                <TextArea name="note" rows={2} placeholder="Optional note to include in delivery email" />
                <Button type="submit">Mark as delivered</Button>
              </form>
            )}
          </Card>
        ))}
        {orders.length === 0 && <Card>No orders yet.</Card>}
      </div>
    </div>
  );
}
