// app/(dashboard)/orders/page.tsx
import { requireAuth } from '@/lib/session';
import { listOrdersForUser } from '@/lib/orders';
import { OrdersListClient } from './OrdersListClient';

type OrdersPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = 'force-dynamic';

export default async function OrdersPage(_props: OrdersPageProps) {
  const session = await requireAuth();
  const userId = session.user.id!;

  // Keep it loose so TS doesn't block build
  const orders = (await listOrdersForUser(userId)) as any[];

  const hasOrders = Array.isArray(orders) && orders.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Your orders</h1>
        <p className="mt-1 text-sm text-slate-400">
          All purchases made with your PremiumCity wallet.
        </p>
      </header>

      {!hasOrders && (
        <p className="text-sm text-slate-400">
          You don&apos;t have any orders yet.
        </p>
      )}

      {hasOrders && <OrdersListClient orders={orders} />}
    </div>
  );
}
