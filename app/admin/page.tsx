// app/admin/page.tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">Admin dashboard</h1>
        <p className="text-sm text-slate-400">
          Manage products, top-ups, orders, and users.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {/* Products & Catalog */}
        <Link href="/admin/products">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">
              Products &amp; Catalog
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage categories, products, pricing, and inventory credentials.
            </p>
          </Card>
        </Link>

        {/* Top-ups */}
        <Link href="/admin/topups">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">
              Wallet top-ups
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Review pending top-ups, approve or reject, and credit wallets.
            </p>
          </Card>
        </Link>

        {/* Orders */}
        <Link href="/admin/orders">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">
              Orders
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              View all orders, deliver manual products, and see credential history.
            </p>
          </Card>
        </Link>

        {/* Users */}
        <Link href="/admin/users">
          <Card className="cursor-pointer p-4 hover:border-emerald-400 hover:bg-slate-900 transition">
            <h2 className="text-lg font-semibold text-slate-100">
              Users
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Search users by email and review their orders.
            </p>
          </Card>
        </Link>
      </section>
    </main>
  );
}
