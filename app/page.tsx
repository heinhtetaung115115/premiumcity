// app/page.tsx
import Link from 'next/link';
import { getActiveCategories } from '@/lib/catalog';
export const dynamic = 'force-dynamic';


export default async function HomePage() {
  const categories = await getActiveCategories();

  const hasCategories = Array.isArray(categories) && categories.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Categories
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Choose a category to see available products.
          </p>
        </div>
      </header>

      {!hasCategories ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-300">
          No categories are available yet. Please check back later.
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category: any) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group block"
            >
              {/* Animated gradient border wrapper */}
              <div className="relative rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 p-[1.5px] animate-gradient-border transition-shadow group-hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                {/* Inner card */}
                <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950 px-4 py-4 md:px-5 md:py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-slate-50 md:text-lg">
                        {category.name}
                      </h2>
                      {category.description && (
                        <p className="line-clamp-2 text-xs text-slate-400 md:text-sm">
                          {category.description}
                        </p>
                      )}
                    </div>

                    {/* Product count pill */}
                    <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                      {category.productCount}{' '}
                      {category.productCount === 1 ? 'item' : 'items'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400 md:text-sm">
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:bg-emerald-300" />
                      View products
                    </span>
                    <span className="text-slate-500 group-hover:text-emerald-200">
                      →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
