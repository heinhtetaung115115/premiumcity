import './globals.css';
import type { Metadata } from 'next';
import { getOptionalSession } from '../lib/session';
import { AuthSessionProvider } from '@/components/session-provider';
import Navbar from '@/components/Navbar';  // <-- FIXED CASE
import { getWalletOverview } from '@/lib/wallet';
import Footer from '@/components/Footer';
import NextTopLoader from 'nextjs-toploader'; // ⬅ Added top progress bar
import { Analytics } from '@vercel/analytics/react'; // ⬅ Vercel Analytics

export const metadata: Metadata = {
  title: 'PremiumCity Digital Storefront',
  description:
    'Wallet based storefront for instant and manual digital goods fulfillment.'
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();

  // Try to load wallet balance (for nav chip)
  let walletBalance: number | null = null;
  if (session?.user?.id) {
    try {
      const overview = await getWalletOverview(session.user.id!);
      walletBalance =
        typeof overview.balance === 'number' &&
        Number.isFinite(overview.balance)
          ? overview.balance
          : 0;
    } catch {
      walletBalance = null;
    }
  }

  const isAuthenticated = !!session?.user;
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 relative">

        {/* 🔥 Ultra-thin animated top progress bar */}
        <NextTopLoader
          color="#22c55e"       // Emerald green
          height={2}
          showSpinner={false}
          crawlSpeed={200}
          speed={350}
          shadow="0 0 8px #22c55e, 0 0 4px #22c55e"
        />

        <AuthSessionProvider session={session}>
          {/* Top navigation */}
          <Navbar
            walletBalance={walletBalance}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
          />

          {/* Main content */}
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

          {/* Footer */}
          <Footer />
        </AuthSessionProvider>

        {/* 📊 Vercel Analytics */}
        <Analytics />

      </body>
    </html>
  );
}
