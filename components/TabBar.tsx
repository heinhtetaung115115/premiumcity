'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HIDE_ON = ['/admin', '/login', '/register', '/forgot-password', '/reset-password', '/panel', '/vpn/'];

const TABS = [
  {
    href: '/',
    label: 'Home',
    match: (p: string) => p === '/' || p.startsWith('/product') || p.startsWith('/category'),
    icon: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />,
  },
  {
    href: '/topup',
    label: 'Top up',
    match: (p: string) => p.startsWith('/topup') || p.startsWith('/wallet'),
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M12 9v6M9 12h6" />
      </>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    match: (p: string) => p.startsWith('/orders'),
    icon: (
      <>
        <path d="M5 4h14l-1 16H6L5 4z" />
        <path d="M9 8a3 3 0 006 0" />
      </>
    ),
  },
  {
    href: '/contact',
    label: 'Support',
    match: (p: string) => p.startsWith('/contact'),
    icon: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />,
  },
];

export default function TabBar() {
  const pathname = usePathname() || '/';
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="glass-bar mx-auto flex max-w-sm items-center justify-between rounded-[26px] p-1.5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`press flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10.5px] font-medium transition-colors ${
                active
                  ? 'bg-white/[0.12] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg
                aria-hidden="true"
                className="h-[22px] w-[22px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
