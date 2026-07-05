'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

type Props = {
  userName?: string | null;
  avatarUrl?: string | null;
  initials: string;
  variant: 'desktop' | 'mobile';
};

export function ProfileMenu({ userName, avatarUrl, initials, variant }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const avatar = avatarUrl ? (
    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 text-[10px] font-bold text-slate-950">
      {initials}
    </span>
  );

  const menuItems = [
    {
      href: '/account',
      label: 'My Account',
      icon: (
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
      ),
    },
    {
      href: '/orders',
      label: 'My Orders',
      icon: (
        <path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 6z" />
      ),
    },
    {
      href: '/account/settings',
      label: 'Account Settings',
      icon: (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </>
      ),
    },
  ];

  const trigger =
    variant === 'desktop' ? (
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
      >
        <span className="h-6 w-6 overflow-hidden rounded-full">{avatar}</span>
        <span className="max-w-[90px] truncate">{userName || 'Account'}</span>
        <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    ) : (
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400"
        aria-label="Account menu"
      >
        <span className="h-7 w-7 overflow-hidden rounded-lg">{avatar}</span>
      </button>
    );

  return (
    <div className="relative" ref={ref}>
      {trigger}

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
            <span className="h-8 w-8 overflow-hidden rounded-full">{avatar}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{userName || 'Account'}</p>
            </div>
          </div>

          {/* Links */}
          <div className="py-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300"
              >
                <svg className="h-[18px] w-[18px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-slate-800 py-1">
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: '/' });
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
            >
              <svg className="h-[18px] w-[18px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
