import Link from 'next/link';
import { getActiveCategories } from '@/lib/catalog';

export default async function HomePage() {
  const categories = await getActiveCategories();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Choose a product category</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Browse our curated catalog of instant deliveries and manual subscription upgrades. Pick a category to see
          available products and pricing options.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="rounded border border-slate-800 bg-slate-900/70 p-6 transition hover:border-emerald-400 hover:bg-slate-900"
          >
            <span className="text-lg font-medium text-emerald-400">{category.name}</span>
            <p className="mt-2 text-sm text-slate-400">{category.description ?? 'Curated digital goods.'}</p>
            <span className="mt-4 inline-block text-xs uppercase tracking-wide text-slate-500">
              {category.productCount} products
            </span>
          </Link>
        ))}
        {categories.length === 0 && (
          <p className="rounded border border-dashed border-slate-800 p-6 text-sm text-slate-400">
            No categories yet. Sign in as an admin to create your first one.
          </p>
        )}
      </div>
    </section>
  );
}
