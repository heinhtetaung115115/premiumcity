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
};

function formatKS(amount: number) {
  return `${amount.toLocaleString()} KS`;
}

function getLowestPrice(product: Product): number {
  const prices = product.variants
    .filter((v) => v.isActive)
    .map((v) => v.price);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

type SortOption = 'default' | 'price_low' | 'price_high' | 'name_az' | 'name_za';

/* ── Product type icons ────────────────────────────────── */

function InstantIcon() {
  return (
    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 16 16" fill="none">
      <path
        d="M8.5 1L3 9.5h4.5L7 15l6-8.5H8.5L9 1z"
        fill="currentColor"
        opacity="0.9"
      />
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

export function HomeClient({ categories, products }: Props) {
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

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      map[p.categoryId] = (map[p.categoryId] ?? 0) + 1;
    }
    return map;
  }, [products]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-5 sm:mb-7">
        <h1 className="text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
          Products
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
          Browse all available products and services.
        </p>
      </header>

      {/* ── Filter bar ─────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur focus:border-emerald-500 focus:outline-none sm:text-xs"
          >
            <option value="all">All ({products.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({countByCategory[cat.id] ?? 0})
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur focus:border-emerald-500 focus:outline-none sm:text-xs"
          >
            <option value="default">Default</option>
            <option value="price_low">Price ↑</option>
            <option value="price_high">Price ↓</option>
            <option value="name_az">A → Z</option>
            <option value="name_za">Z → A</option>
          </select>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 placeholder:text-slate-600 backdrop-blur focus:border-emerald-500 focus:outline-none sm:w-48 sm:text-xs"
          />
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Active filter indicator */}
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

      {/* ── Product grid ───────────────────────────────── */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-xs text-slate-500">
          No products found. Try a different filter.
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSorted.map((product) => {
            const sorted = [...product.variants]
              .filter((v) => v.isActive)
              .sort((a, b) => a.price - b.price);
            const cheapest = sorted.length > 0 ? sorted[0] : null;
            const isInstant = product.productType === 'INSTANT';
            const isOutOfStock = product.isInStock === false;

            return (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="group relative block"
              >
                {/* Card */}
                <div
                  className={`
                    relative flex h-full flex-col overflow-hidden rounded-xl border
                    transition-all duration-300
                    ${
                      isOutOfStock
                        ? 'border-slate-800/60 bg-slate-900/30'
                        : 'border-slate-800/80 bg-slate-900/50 group-hover:border-emerald-500/40 group-hover:bg-slate-900/70'
                    }
                  `}
                >
                  {/* Top shimmer line on hover */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent transition-all duration-500 group-hover:via-emerald-400/60" />

                  {/* Inner content */}
                  <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
                    {/* ── Row 1: Category tag ── */}
                    <span className="mb-1.5 self-start rounded-md bg-slate-800/70 px-1.5 py-[2px] text-[8px] font-medium uppercase tracking-wider text-slate-400 sm:text-[9px]">
                      {product.categoryName}
                    </span>

                    {/* ── Row 2: Product name ── */}
                    <h2 className="text-[11px] font-semibold leading-snug text-slate-100 line-clamp-2 sm:text-sm sm:leading-snug">
                      {product.name}
                    </h2>

                    {/* ── Row 3: Description (desktop only) ── */}
                    {product.description && (
                      <p className="mt-0.5 hidden text-[11px] leading-relaxed text-slate-500 line-clamp-2 sm:block">
                        {product.description}
                      </p>
                    )}

                    {/* Spacer pushes bottom content down */}
                    <div className="flex-1" />

                    {/* ── Row 4: Price + delivery type ── */}
                    <div className="mt-2.5 flex items-end justify-between gap-1 sm:mt-3">
                      {/* Price */}
                      <div>
                        {isOutOfStock ? (
                          <span className="text-[10px] font-medium text-red-400/80 sm:text-xs">
                            Out of stock
                          </span>
                        ) : cheapest ? (
                          <>
                            <p className="text-[9px] text-slate-500 sm:text-[10px]">
                              from
                            </p>
                            <p className="text-sm font-bold tracking-tight text-emerald-400 sm:text-base">
                              {formatKS(cheapest.price)}
                            </p>
                          </>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-400 sm:text-xs">
                            Available
                          </span>
                        )}
                      </div>

                      {/* Delivery badge */}
                      <span
                        className={`
                          inline-flex items-center gap-0.5 rounded-md px-1.5 py-[3px] text-[8px] font-medium sm:text-[9px]
                          ${
                            isInstant
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-sky-500/10 text-sky-400'
                          }
                        `}
                      >
                        {isInstant ? <InstantIcon /> : <ManualIcon />}
                        <span className="hidden sm:inline">
                          {isInstant ? 'Instant' : 'Manual'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Bottom hover indicator */}
                  <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 transition-all duration-500 group-hover:from-emerald-500/0 group-hover:via-emerald-400/50 group-hover:to-emerald-500/0" />
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
