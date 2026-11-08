'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileMenu } from '@/components/ProfileMenu';

type NavbarProps = {
  walletBalance: number | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  userName?: string | null;
  avatarUrl?: string | null;
};

const LINKS = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/topup', label: 'Top up', match: (p: string) => p.startsWith('/topup') },
  { href: '/orders', label: 'Orders', match: (p: string) => p.startsWith('/orders') },
  { href: '/contact', label: 'Support', match: (p: string) => p.startsWith('/contact') },
];

export default function Navbar({
  isAuthenticated,
  isAdmin,
  userName,
  avatarUrl
}: NavbarProps) {
  const pathname = usePathname();

  const initials = (userName || 'Account')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 px-3 pt-2 sm:px-6 sm:pt-3">
      <nav className="glass-bar mx-auto flex max-w-6xl items-center justify-between rounded-[22px] py-2 pl-2 pr-2 sm:pl-2.5">
        {/* Brand */}
        <Link href="/" className="press flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/premiumcity-logo.png" alt="" className="h-full w-full object-contain p-0.5" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">PremiumCity</span>
        </Link>

        {/* Desktop: segmented links */}
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-center rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/[0.06]">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                    active
                      ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-amber-300 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-400/10"
            >
              Admin
            </Link>
          )}

          {isAuthenticated ? (
            <ProfileMenu userName={userName} avatarUrl={avatarUrl} initials={initials} variant="desktop" />
          ) : (
            <Link href="/login" className="btn-primary press rounded-full px-4 py-1.5 text-[13px] font-semibold">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile: admin + profile only (main nav lives in the bottom tab bar) */}
        <div className="flex items-center gap-1.5 md:hidden">
          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin"
              className="press inline-flex h-9 w-9 items-center justify-center rounded-full text-amber-300 ring-1 ring-inset ring-amber-400/40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
          {isAuthenticated ? (
            <ProfileMenu userName={userName} avatarUrl={avatarUrl} initials={initials} variant="mobile" />
          ) : (
            <Link href="/login" className="btn-primary press inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
