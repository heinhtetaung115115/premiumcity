import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryBySlug } from '@/lib/catalog';
import { formatCurrency } from '@/utils/currency';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{category.name}</h1>
        {category.description && <p className="max-w-3xl text-sm text-slate-400">{category.description}</p>}
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {category.products.map((product) => {
          const cheapestVariant = product.variants.reduce((prev, current) => {
            if (!prev) return current;
            return Number(current.price) < Number(prev.price) ? current : prev;
          }, product.variants[0]);
          return (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="rounded border border-slate-800 bg-slate-900/70 p-6 transition hover:border-emerald-400 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-emerald-300">{product.name}</span>
                <span className="rounded border border-emerald-500/50 px-2 py-1 text-xs uppercase text-emerald-400">
                  {product.productType === 'INSTANT' ? 'Instant delivery' : 'Manual delivery'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{product.description}</p>
              {cheapestVariant && (
                <p className="mt-4 text-sm text-slate-300">
                  Starting at {formatCurrency(Number(cheapestVariant.price))}
                </p>
              )}
            </Link>
          );
        })}
        {category.products.length === 0 && (
          <p className="rounded border border-dashed border-slate-800 p-6 text-sm text-slate-400">
            No products available in this category yet.
          </p>
        )}
      </div>
    </section>
  );
}
