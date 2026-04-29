import Link from 'next/link';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

export default function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={`/category/${category.slug}`} className="group block">
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
            {/* Small pill showing product count */}
            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
              {category.productCount} item{category.productCount === 1 ? '' : 's'}
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
  );
}
