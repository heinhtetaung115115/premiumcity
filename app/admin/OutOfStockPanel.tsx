'use client';

import { useState } from 'react';
import Link from 'next/link';

type OutOfStockVariant = {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
};

// Compact, collapsed by default: shows just a count pill. Click to expand the
// list of out-of-stock variants. Takes almost no space until you want it.
export function OutOfStockPanel({ items }: { items: OutOfStockVariant[] }) {
  const [open, setOpen] = useState(false);
  const count = items.length;
  const allGood = count === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => !allGood && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
          allGood ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.02]'
        }`}
      >
        <span className="text-sm font-semibold text-slate-100">Out of stock</span>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            allGood ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {count}
        </span>

        {!allGood && (
          <svg
            className={`ml-auto h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        {allGood && (
          <span className="ml-auto text-[11px] text-slate-500">Everything in stock</span>
        )}
      </button>

      {open && !allGood && (
        <div className="border-t border-white/5">
          <ul className="divide-y divide-white/5">
            {items.map((v) => (
              <li
                key={`${v.productId}-${v.variantId ?? 'base'}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{v.productName}</p>
                  {v.variantName && (
                    <p className="truncate text-[11px] text-slate-400">{v.variantName}</p>
                  )}
                </div>
                <span className="flex-shrink-0 rounded-md bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-300">
                  0 left
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/5 px-4 py-2.5">
            <Link href="/admin/products" className="text-xs text-emerald-400 hover:text-emerald-300">
              Manage products &amp; restock →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
