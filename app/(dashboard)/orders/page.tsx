// app/(dashboard)/orders/page.tsx
import { requireAuth } from '@/lib/session';
import { listOrdersForUserPaged } from '@/lib/orders';
import { OrdersListClient } from './OrdersListClient';

type OrdersPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await requireAuth();
  const userId = session.user.id!;

  const pageRaw = searchParams?.page;
  const pageNum = Math.max(1, parseInt(typeof pageRaw === 'string' ? pageRaw : '1', 10) || 1);

  const { orders, total, page, totalPages } = await listOrdersForUserPaged(userId, pageNum, PAGE_SIZE);

  const hasOrders = total > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Your orders</h1>
        <p className="mt-1 text-sm text-slate-400">
          All purchases made with your PremiumCity wallet.
        </p>
      </header>

      {!hasOrders && (
        <p className="text-sm text-slate-400">You don&apos;t have any orders yet.</p>
      )}

      {hasOrders && (
        <OrdersListClient
          orders={orders as any[]}
          page={page}
          totalPages={totalPages}
          total={total}
        />
      )}
    </div>
  );
}
