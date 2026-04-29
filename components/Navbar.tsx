'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavbarProps = {
  walletBalance: number | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

const mainLinks = [
  { href: '/', label: 'Home' },
  { href: '/topup', label: 'Top up' },
  { href: '/orders', label: 'Orders' },
  { href: '/contact', label: 'Contact' }
];

export default function Navbar({
  walletBalance,
  isAuthenticated,
  isAdmin
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function toggleMenu() {
    setOpen((prev) => !prev);
  }

  function closeMenu() {
    setOpen(false);
  }

  const walletLabel =
    walletBalance != null
      ? `${walletBalance.toLocaleString('en-US')} MMK`
      : 'Wallet';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">

        {/* LEFT: Logo / brand */}
        <Link
          href="/"
          onClick={closeMenu}
          className="flex items-center gap-2"
        >
          <div className="relative flex h-9 w-9 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/25" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin-slow" />
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-slate-950">
              PC
            </span>
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-50">
              PremiumCity
            </span>
            <span className="text-[11px] text-slate-400">
              Digital Storefront
            </span>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden items-center gap-3 md:flex">
          {mainLinks.map((link) => {
            const isActive =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-emerald-300'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* WALLET CHIP (desktop) */}
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/70 bg-slate-900 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:bg-slate-900/60"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px]">
              💳
            </span>
            <span className="whitespace-nowrap">{walletLabel}</span>
          </Link>

          {/* ADMIN BADGE */}
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full border border-amber-500/80 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-400 hover:bg-slate-900/60"
            >
              Admin
            </Link>
          )}

          {/* AUTH BUTTON */}
          {isAuthenticated ? (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* MOBILE RIGHT SIDE: wallet + burger */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Wallet pill always visible on mobile */}
         {/* Wallet pill always visible on mobile with glow */}
<Link
  href="/wallet"
  onClick={closeMenu}
  className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300
             shadow-[0_0_8px_2px_rgba(16,185,129,0.45)]
             hover:shadow-[0_0_12px_3px_rgba(16,185,129,0.6)] transition-shadow"
>
  💳 <span className="max-w-[90px] truncate">{walletLabel}</span>
</Link>


          {/* Mobile burger */}
          <button
            type="button"
            onClick={toggleMenu}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-100"
          >
            <span className="sr-only">Toggle menu</span>
            <span className={`absolute block h-[2px] w-5 rounded-full bg-slate-100 transition-transform duration-200 ${
              open ? 'translate-y-0 rotate-45' : '-translate-y-2'
            }`} />
            <span className={`absolute block h-[2px] w-5 rounded-full bg-slate-100 transition-opacity duration-150 ${
              open ? 'opacity-0' : 'opacity-100'
            }`} />
            <span className={`absolute block h-[2px] w-5 rounded-full bg-slate-100 transition-transform duration-200 ${
              open ? 'translate-y-0 -rotate-45' : 'translate-y-2'
            }`} />
          </button>
        </div>
      </nav>

      {/* MOBILE OVERLAY MENU */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button onClick={closeMenu} className="absolute inset-0 bg-black/20" />
          <div className="absolute right-3 top-16 w-64 rounded-2xl border border-emerald-500/30 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm">
            <div className="space-y-1">
              {mainLinks.map((link) => {
                const isActive =
                  link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className={`flex items-center rounded-xl px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900/70 text-slate-100 hover:bg-slate-800 hover:text-emerald-300'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="my-2 h-px bg-slate-800" />

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className="flex-1 rounded-xl border border-amber-500/70 bg-slate-900/80 px-3 py-1.5 text-center text-[11px] font-medium text-amber-300 hover:border-amber-400 hover:bg-slate-900"
                >
                  Admin
                </Link>
              )}

              {isAuthenticated ? (
                <form
                  action="/api/auth/signout"
                  method="post"
                  className={isAdmin ? 'flex-1' : 'w-full'}
                >
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className={`${isAdmin ? 'flex-1' : 'w-full'} rounded-xl border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-center text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20`}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
