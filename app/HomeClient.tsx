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
  imageUrl?: string | null;
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
  return `${amount.toLocaleString()} Ks`;
}

// Category names in the DB carry emoji ("Music 🎧"); show clean labels.
function cleanLabel(name: string) {
  return name.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
}

function shortName(full?: string | null) {
  if (!full) return null;
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(0, 2).join(' ') : parts[0];
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

  return (
    <div className="mx-auto max-w-6xl">
      {/* Greeting */}
      <header className="mb-4 flex items-center gap-3 px-1">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-white/15" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-1 ring-white/15">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
            </svg>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] text-slate-400">{userName ? 'မင်္ဂလာပါ' : 'Welcome to'}</p>
          <p className="truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white">
            {shortName(userName) || 'PremiumCity'}
          </p>
        </div>
      </header>

      {walletBalance != null && (
        <section className="glass-emerald mb-6 rounded-[28px] p-5 sm:p-6">
          <div className="relative z-[1] flex items-start justify-between">
            <p className="text-[13px] font-medium text-emerald-50/85">Wallet balance</p>
            <Link href="/wallet" className="text-[12px] font-medium text-emerald-50/85 underline-offset-2 hover:underline">
              History
            </Link>
          </div>
          <p className="relative z-[1] mb-5 mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums">
            {walletBalance.toLocaleString()}
            <span className="ml-1.5 text-lg font-medium text-emerald-50/90">Ks</span>
          </p>
          <div className="relative z-[1] grid grid-cols-2 gap-2.5">
            <Link
              href="/topup"
              className="glass-btn press flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Top up
            </Link>
            <Link
              href="/orders"
              className="glass-btn press flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 4h14l-1 16H6L5 4z" strokeLinejoin="round" />
                <path d="M9 8a3 3 0 006 0" strokeLinecap="round" />
              </svg>
              My orders
            </Link>
          </div>
        </section>
      )}

      {/* Search */}
      <div className="glass mb-4 flex items-center gap-2.5 rounded-2xl px-3.5 focus-within:ring-1 focus-within:ring-emerald-400/60">
        <svg className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          aria-label="Search products"
          placeholder="Netflix, VPN, Spotify…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 w-full bg-transparent text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery('')}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-slate-200"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Categories: glass segmented chips */}
      {categories.length > 0 && (
        <div className="no-scrollbar -mx-3 mb-6 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {[{ id: 'all', name: 'All', slug: '' }, ...categories].map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCategory(active && cat.id !== 'all' ? 'all' : cat.id)}
                  className={`press flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium transition-colors ${
                    active
                      ? 'bg-white text-slate-950 shadow-[0_6px_18px_-8px_rgba(255,255,255,0.5)]'
                      : 'glass text-slate-200 hover:text-white'
                  }`}
                >
                  {cat.id !== 'all' && (
                    <span className={`[&>svg]:h-4 [&>svg]:w-4 ${active ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {categoryIcon(cat.name)}
                    </span>
                  )}
                  {cleanLabel(cat.name)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">
          {selectedCategory === 'all'
            ? 'Shop'
            : cleanLabel(categories.find((c) => c.id === selectedCategory)?.name ?? 'Products')}
        </h2>
        {selectedCategory !== 'all' || searchQuery.trim() ? (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setSortBy('default');
            }}
            className="text-[13px] font-medium text-emerald-400 hover:text-emerald-300"
          >
            Clear · {filteredAndSorted.length} of {products.length}
          </button>
        ) : (
          <span className="text-[13px] text-slate-500">{products.length} products</span>
        )}
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="glass rounded-[24px] px-4 py-12 text-center">
          <p className="text-[15px] font-medium text-slate-200">
            {searchQuery.trim() ? `No results for “${searchQuery.trim()}”` : 'Nothing here yet'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">ရှာမတွေ့ပါက Support မှာ မေးမြန်းနိုင်ပါတယ်</p>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSorted.map((product) => {
            const sorted = [...product.variants].filter((v) => v.isActive).sort((a, b) => a.price - b.price);
            const cheapest = sorted.length > 0 ? sorted[0] : null;
            const isInstant = product.productType === 'INSTANT';
            const isOutOfStock = product.isInStock === false;

            return (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className={`glass press group flex flex-col rounded-[24px] p-1.5 transition-colors ${
                  isOutOfStock ? 'opacity-70' : 'hover:border-white/20'
                }`}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-slate-800/40">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
                        isOutOfStock ? 'grayscale' : ''
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-emerald-500/[0.08] text-emerald-400">
                      <div className="scale-[1.8]">{categoryIcon(product.categoryName)}</div>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-[3px] text-[10px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md">
                    {isInstant ? <InstantIcon /> : <ManualIcon />}
                    {isInstant ? 'Instant' : 'Manual'}
                  </span>
                  {isOutOfStock && (
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 py-1 text-center text-[11px] font-semibold text-white backdrop-blur-md">
                      Sold out
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col px-2 pb-2 pt-2.5">
                  <p className="text-[11px] font-medium text-slate-500">{cleanLabel(product.categoryName)}</p>
                  <h3 className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-slate-50 sm:text-[15px]">
                    {product.name}
                  </h3>
                  <div className="flex-1" />
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    {isOutOfStock ? (
                      <span className="text-[13px] font-medium text-slate-500">Restocking soon</span>
                    ) : cheapest ? (
                      <p className="text-[15px] font-semibold tracking-[-0.01em] text-emerald-400 tabular-nums sm:text-base">
                        <span className="mr-1 text-[11px] font-normal text-slate-500">from</span>
                        {formatKS(cheapest.price)}
                      </p>
                    ) : (
                      <span className="text-[13px] font-medium text-emerald-400">Available</span>
                    )}
                    {!isOutOfStock && (
                      <span
                        aria-hidden="true"
                        className="btn-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
