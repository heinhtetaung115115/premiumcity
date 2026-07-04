'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Variant = {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  position: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  productType: string;
  isInStock: boolean;
  variants: Variant[];
};

type Props = {
  categories: Category[];
  products: Product[];
  walletBalance?: number | null;
  userName?: string | null;
  avatarUrl?: string | null;
};

function formatKS(amount: number) {
  return `${amount.toLocaleString()} KS`;
}

function getLowestPrice(product: Product): number {
  const prices = product.variants.filter((v) => v.isActive).map((v) => v.price);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

type SortOption = 'default' | 'price_low' | 'price_high' | 'name_az' | 'name_za';

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  const cls = 'h-6 w-6';
  if (n.includes('stream') || n.includes('netflix') || n.includes('video'))
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (n.includes('game') || n.includes('gaming'))
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="2" y="7" width="20" height="10" rx="4" />
        <path d="M7 12h2M8 11v2" strokeLinecap="round" />
        <circle cx="16" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="13" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  if (n.includes('vpn') || n.includes('security') || n.includes('outline'))
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (n.includes('music') || n.includes('spotify'))
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14c2-1 5-1 7 0M8 11c2.5-1 6-1 8 .5M8.5 8.5c2.5-.8 6 0 7.5 1" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function InstantIcon() {
  return (
    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 16 16" fill="none">
      <path d="M8.5 1L3 9.5h4.5L7 15l6-8.5H8.5L9 1z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function ManualIcon() {
  return (
    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeClient({ categories, products, walletBalance, userName, avatarUrl }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSorted = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => getLowestPrice(a) - getLowestPrice(b));
        break;
      case 'price_high':
        result.sort((a, b) => getLowestPrice(b) - getLowestPrice(a));
        break;
      case 'name_az':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_za':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    return result;
  }, [products, selectedCategory, sortBy, searchQuery]);

  const topCategories = categories;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-10 w-10 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-[11px] text-slate-500">
              {userName ? `Welcome back,` : 'Welcome to'}
            </p>
            <p className="text-base font-semibold text-slate-50">
              {userName || 'PremiumCity'}
            </p>
          </div>
        </div>
      </header>

      {walletBalance != null && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
          <p className="text-[13px] text-emerald-50/90">Wallet balance</p>
          <p className="mb-4 text-3xl font-semibold text-white">
            {walletBalance.toLocaleString()} <span className="text-base">KS</span>
          </p>
          <div className="flex gap-2.5">
            <Link
              href="/topup"
              className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-white/20 py-2.5 text-white transition hover:bg-white/25"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium">Top up</span>
            </Link>
            <Link
              href="/orders"
              className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-white/20 py-2.5 text-white transition hover:bg-white/25"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium">Orders</span>
            </Link>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-slate-50">Categories</p>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Show all
              </button>
            )}
          </div>
          {/* Horizontal swipeable categories */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3">
              {topCategories.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(active ? 'all' : cat.id)}
                    className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5"
                  >
                    <div
                      className={`flex h-[68px] w-[68px] items-center justify-center rounded-2xl border transition ${
                        active
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                          : 'border-slate-800/80 bg-slate-900/50 text-emerald-400 hover:border-emerald-500/40'
                      }`}
                    >
                      {categoryIcon(cat.name)}
                    </div>
                    <span className="line-clamp-1 w-full text-center text-[11px] text-slate-300">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search only */}
      <div className="mb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-600 backdrop-blur focus:border-emerald-500 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {(selectedCategory !== 'all' || searchQuery.trim()) && (
        <p className="mb-4 text-[10px] text-slate-500 sm:text-xs">
          {filteredAndSorted.length} of {products.length} products
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setSortBy('default');
            }}
            className="ml-2 text-emerald-400 hover:text-emerald-300"
          >
            Reset
          </button>
        </p>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold text-slate-50">
          {selectedCategory === 'all'
            ? 'All products'
            : categories.find((c) => c.id === selectedCategory)?.name ?? 'Products'}
        </p>
        <span className="text-xs text-slate-500">{filteredAndSorted.length} items</span>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-xs text-slate-500">
          No products found. Try a different filter.
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSorted.map((product) => {
            const sorted = [...product.variants]
              .filter((v) => v.isActive)
              .sort((a, b) => a.price - b.price);
            const cheapest = sorted.length > 0 ? sorted[0] : null;
            const isInstant = product.productType === 'INSTANT';
            const isOutOfStock = product.isInStock === false;

            return (
              <Link key={product.id} href={`/product/${product.slug}`} className="group relative block">
                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-3 transition-all duration-300 sm:p-3.5 ${
                    isOutOfStock
                      ? 'border-slate-800/60 bg-slate-900/30'
                      : 'border-slate-800/80 bg-slate-900/50 group-hover:border-emerald-500/40 group-hover:bg-slate-900/70'
                  }`}
                >
                  <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
                    {categoryIcon(product.categoryName)}
                  </div>

                  <span className="mb-1 self-start rounded-md bg-slate-800/70 px-1.5 py-[2px] text-[8px] font-medium uppercase tracking-wider text-slate-400 sm:text-[9px]">
                    {product.categoryName}
                  </span>

                  <h2 className="text-[11px] font-semibold leading-snug text-slate-100 line-clamp-2 sm:text-sm">
                    {product.name}
                  </h2>

                  {product.description && (
                    <p className="mt-0.5 hidden text-[11px] leading-relaxed text-slate-500 line-clamp-1 sm:block">
                      {product.description}
                    </p>
                  )}

                  <div className="flex-1" />

                  <div className="mt-2.5 flex items-end justify-between gap-1">
                    <div>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-medium text-red-400/80 sm:text-xs">Out of stock</span>
                      ) : cheapest ? (
                        <>
                          <p className="text-[9px] text-slate-500 sm:text-[10px]">from</p>
                          <p className="text-sm font-bold tracking-tight text-emerald-400 sm:text-base">
                            {formatKS(cheapest.price)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-400 sm:text-xs">Available</span>
                      )}
                    </div>

                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-500/10 px-1.5 py-[3px] text-[8px] font-medium text-sky-400 sm:text-[9px]">
                        {isInstant ? <InstantIcon /> : <ManualIcon />}
                        <span className="hidden sm:inline">{isInstant ? 'Instant' : 'Manual'}</span>
                      </span>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 transition group-hover:bg-emerald-400">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
