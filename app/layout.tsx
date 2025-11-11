import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getOptionalSession } from '@/lib/session';
import { AuthSessionProvider } from '@/components/session-provider';

export const metadata: Metadata = {
  title: 'PremiumCity Digital Storefront',
  description: 'Wallet based storefront for instant and manual digital goods fulfillment.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AuthSessionProvider session={session}>
          <header className="border-b border-slate-800 bg-slate-900">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
              <Link href="/" className="text-lg font-semibold text-emerald-400">
                PremiumCity
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="hover:text-emerald-300">
                  Categories
                </Link>
                <Link href="/topup" className="hover:text-emerald-300">
                  Top up wallet
                </Link>
                <Link href="/(dashboard)/orders" className="hover:text-emerald-300">
                  Orders
                </Link>
                <Link href="/(dashboard)/wallet" className="hover:text-emerald-300">
                  Wallet
                </Link>
                <Link href="/contact" className="hover:text-emerald-300">
                  Contact us
                </Link>
                {session?.user ? (
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="rounded border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                    >
                      Sign out
                    </button>
                  </form>
                ) : (
                  <Link href="/login" className="rounded border border-emerald-500 px-3 py-1 text-emerald-400 hover:bg-emerald-500/10">
                    Sign in
                  </Link>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          <footer className="border-t border-slate-800 bg-slate-900">
            <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-400">
              © {new Date().getFullYear()} PremiumCity. All rights reserved.
            </div>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
