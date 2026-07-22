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

export default function Navbar({
  walletBalance,
  isAuthenticated,
  isAdmin,
  userName,
  avatarUrl
}: NavbarProps) {
  const pathname = usePathname();

  const walletLabel =
    walletBalance != null
      ? `${walletBalance.toLocaleString('en-US')} MMK`
      : 'Wallet';

  // Initials for the profile avatar
  const initials = (userName || 'Account')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">

        {/* LEFT: Logo / brand */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-slate-950">
            PC
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-50">PremiumCity</span>
            <span className="text-[11px] text-slate-400">Digital Storefront</span>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname === '/'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-emerald-300'
            }`}
          >
            Home
          </Link>
          <Link
            href="/topup"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname.startsWith('/topup')
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-emerald-300'
            }`}
          >
            Top up
          </Link>
          <Link
            href="/orders"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname.startsWith('/orders')
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-emerald-300'
            }`}
          >
            Orders
          </Link>
          <Link
            href="/contact"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname.startsWith('/contact')
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-emerald-300'
            }`}
          >
            Contact
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full border border-amber-500/80 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-400"
            >
              Admin
            </Link>
          )}

          {/* Profile / auth */}
          {isAuthenticated ? (
            <ProfileMenu
              userName={userName}
              avatarUrl={avatarUrl}
              initials={initials}
              variant="desktop"
            />
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* MOBILE RIGHT SIDE: Talk to support + profile */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Admin (admins only) */}
          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-amber-500/80 bg-slate-900 px-2.5 text-[11px] font-medium text-amber-300 hover:border-amber-400"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Admin</span>
            </Link>
          )}

          {/* Talk to support */}
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Talk to support</span>
          </Link>

          {/* Profile icon button */}
          {isAuthenticated ? (
            <ProfileMenu
              userName={userName}
              avatarUrl={avatarUrl}
              initials={initials}
              variant="mobile"
            />
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-500 px-3 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/10"
              aria-label="Sign in"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
