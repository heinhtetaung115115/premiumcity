import Link from 'next/link';
import { Card } from '@/components/ui';

const links = [
  { href: '/admin/products', label: 'Catalog & Banks', description: 'Manage categories, products, variants, and bank accounts.' },
  { href: '/admin/topups', label: 'Top ups', description: 'Approve or reject wallet funding requests.' },
  { href: '/admin/orders', label: 'Orders', description: 'Inspect orders and manual fulfillment details.' }
];

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Admin dashboard</h1>
        <p className="text-sm text-slate-400">Configure catalog, review payments, and deliver manual products.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((link) => (
          <Card key={link.href}>
            <Link href={link.href} className="block space-y-2">
              <span className="text-lg font-medium text-emerald-300">{link.label}</span>
              <p className="text-sm text-slate-400">{link.description}</p>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
