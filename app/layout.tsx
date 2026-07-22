import './globals.css';
import type { Metadata } from 'next';
import { getOptionalSession } from '../lib/session';
import { AuthSessionProvider } from '@/components/session-provider';
import Navbar from '@/components/Navbar';  // <-- FIXED CASE
import { getWalletOverview } from '@/lib/wallet';
import Footer from '@/components/Footer';
import { WelcomeRewardPopup } from '@/components/WelcomeRewardPopup';
import NextTopLoader from 'nextjs-toploader'; // ⬅ Added top progress bar
import { Analytics } from '@vercel/analytics/react'; // ⬅ Vercel Analytics

export const metadata: Metadata = {
  metadataBase: new URL('https://pcitystore.com'),
  title: 'PremiumCity — Premium subscriptions, instant delivery',
  description:
    'Buy Netflix, Prime Video, VPN, AI subscriptions & more. Instant delivery, secure payment, 24/7 support.',
  openGraph: {
    type: 'website',
    url: 'https://pcitystore.com',
    siteName: 'PremiumCity',
    title: 'PremiumCity — Premium subscriptions, instant delivery',
    description:
      'Buy Netflix, Prime Video, VPN, AI subscriptions & more. Instant delivery, secure payment, 24/7 support.',
    images: [
      {
        url: '/premiumcity-og.png',
        width: 1200,
        height: 630,
        alt: 'PremiumCity — premium subscriptions, instant delivery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PremiumCity — Premium subscriptions, instant delivery',
    description:
      'Buy Netflix, Prime Video, VPN, AI subscriptions & more. Instant delivery, secure payment, 24/7 support.',
    images: ['/premiumcity-og.png'],
  },
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();

  // Load wallet balance + fresh name/avatar from the database
  let walletBalance: number | null = null;
  let userName: string | null =
    (session?.user as any)?.email?.split('@')[0] || null;
  let avatarUrl: string | null = null;
  let showWelcomePopup = false;

  if (session?.user?.id) {
    try {
      const overview = await getWalletOverview(session.user.id!);
      walletBalance =
        typeof overview.balance === 'number' && Number.isFinite(overview.balance)
          ? overview.balance
          : 0;
    } catch {
      walletBalance = null;
    }

    // Fresh name + avatar (JWT token may be stale after profile edits)
    try {
      const { getServiceSupabaseClient } = await import('@/lib/supabase');
      const supabase = getServiceSupabaseClient();
      const { data: userRow } = await supabase
        .from('users')
        .select('name,email,avatar_url,welcome_popup_seen,profile_reward_claimed')
        .eq('id', session.user.id!)
        .maybeSingle();
      const u = (userRow as any) ?? {};
      userName = u.name || u.email?.split('@')[0] || userName;
      avatarUrl = u.avatar_url ?? null;
      showWelcomePopup = !u.welcome_popup_seen && !u.profile_reward_claimed;
    } catch {
      // keep fallback userName
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
          {/* One-time welcome reward popup */}
          <WelcomeRewardPopup show={showWelcomePopup} />

          {/* Top navigation */}
          <Navbar
            walletBalance={walletBalance}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            userName={userName}
            avatarUrl={avatarUrl}
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
