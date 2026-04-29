import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/catalog";

type CategoryPageProps = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

function formatKS(amount: number) {
  return `${amount.toLocaleString()} KS`;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const category = await getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const { products } = category;
  const hasProducts = Array.isArray(products) && products.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* BACK BUTTON */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200"
          >
            ← Back
          </Link>
        </div>

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-100">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-2 text-sm text-slate-400">
              {category.description}
            </p>
          )}
        </header>

        {!hasProducts && (
          <p className="text-sm text-slate-400">
            No products in this category yet.
          </p>
        )}

        {hasProducts && (
          <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product: any) => {
              const variants = product.variants ?? [];
              const sorted = [...variants].sort(
                (a, b) => Number(a.price) - Number(b.price)
              );
              const cheapest = sorted.length > 0 ? sorted[0] : null;

              const isInstant = product.productType === "INSTANT";
              const isOutOfStock = product.isInStock === false;

              return (
                <Link key={product.id} href={`/product/${product.slug}`} className="group block">
                  
                  {/* Dimmed / low-opacity gradient border */}
                  <div className="relative rounded-2xl 
                      bg-gradient-to-r 
                      from-emerald-500/25 
                      via-teal-400/25 
                      to-emerald-500/25 
                      p-[1.5px]
                      animate-gradient-border
                      transition-shadow
                      group-hover:shadow-[0_0_18px_rgba(16,185,129,0.18)]
                    ">

                    {/* Inner card */}
                    <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950 px-4 py-4 md:px-5 md:py-5">
                      
                      {/* Type badge */}
                      <span className="mb-2 inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-emerald-300">
                        {isInstant ? "Instant delivery" : "Manual delivery"}
                      </span>

                      {/* Name + price in one row */}
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h2 className="text-lg md:text-xl font-semibold text-slate-50">
                            {product.name}
                          </h2>

                          {!isOutOfStock && cheapest && (
                            <span className="text-sm font-semibold text-emerald-300 whitespace-nowrap">
                              {formatKS(Number(cheapest.price))}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="line-clamp-2 text-xs text-slate-400 md:text-sm">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="mt-4 flex items-center justify-between text-sm">
                        {isOutOfStock ? (
                          <span className="inline-flex rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300">
                            Out of stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                            In stock
                          </span>
                        )}

                        <span className="text-slate-500 group-hover:text-emerald-200">
                          →
                        </span>
                      </div>

                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
